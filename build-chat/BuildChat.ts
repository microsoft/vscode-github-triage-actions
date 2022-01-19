/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Octokit } from '@octokit/rest'
import { WebClient } from '@slack/web-api'
import { BlobServiceClient } from '@azure/storage-blob'

let safeLog: (message: string, ...args: any[]) => void // utils.ts needs GITHUB_REPOSITORY set below.

if (require.main === module) {
	process.env.GITHUB_REPOSITORY = 'microsoft/vscode-remote-containers'
	safeLog = require('../common/utils').safeLog
	const auth = `token ${process.env.GITHUB_TOKEN}`
	const octokit = new Octokit({ auth })
	const workflowUrl =
		'https://api.github.com/repos/microsoft/vscode-remote-containers/actions/runs/552662814'
	const options: Options = {
		slackToken: process.env.SLACK_TOKEN,
		storageConnectionString: process.env.STORAGE_CONNECTION_STRING,
		notifyAuthors: true,
		notificationChannel: 'bottest',
		logChannel: 'bot-log',
	}
	;(async () => {
		await buildChat(octokit, workflowUrl, options)
	})().then(undefined, safeLog)
} else {
	safeLog = require('../common/utils').safeLog
}

export interface Options {
	slackToken?: string
	storageConnectionString?: string
	notifyAuthors?: boolean
	notificationChannel?: string
	logChannel?: string
}

export async function buildChat(octokit: Octokit, workflowUrl: string, options: Options = {}) {
	safeLog(workflowUrl)
	const parts = workflowUrl.split('/')
	const owner = parts[parts.length - 5]
	const repo = parts[parts.length - 4]
	const runId = parseInt(parts[parts.length - 1], 10)
	await handleNotification(octokit, owner, repo, runId, options)
}

interface UserOrChannel {
	id: string
	name: string
}

interface Team {
	members: UserOrChannel[]
}

async function handleNotification(
	octokit: Octokit,
	owner: string,
	repo: string,
	runId: number,
	options: Options,
) {
	const results = await buildComplete(octokit, owner, repo, runId, options)
	if (options.slackToken && (results.logMessages.length || results.messages.length)) {
		const web = new WebClient(options.slackToken)
		const memberships = await listAllMemberships(web)

		const logChannel = options.logChannel && memberships.find((m) => m.name === options.logChannel)
		if (options.logChannel && !logChannel) {
			safeLog(`Log channel not found: ${options.logChannel}`)
		}
		if (logChannel) {
			for (const logMessage of results.logMessages) {
				await web.chat.postMessage({
					text: logMessage,
					link_names: true,
					channel: logChannel.id,
					as_user: true,
				})
			}
		}

		const usersByName: Record<string, UserOrChannel> = {}
		if (options.notifyAuthors) {
			for await (const page of web.paginate('users.list')) {
				for (const member of ((page as unknown) as Team).members) {
					usersByName[member.name] = member
				}
			}
		}

		const notificationChannel =
			options.notificationChannel && memberships.find((m) => m.name === options.notificationChannel)
		if (options.notificationChannel && !notificationChannel) {
			safeLog(`Notification channel not found: ${options.notificationChannel}`)
		}
		for (const message of results.messages) {
			const notificationChannels: UserOrChannel[] = []
			if (logChannel) {
				notificationChannels.push(logChannel)
			}
			if (notificationChannel) {
				notificationChannels.push(notificationChannel)
			}
			if (options.notifyAuthors) {
				for (const slackAuthor of message.slackAuthors) {
					const user = usersByName[slackAuthor]
					if (user) {
						const channel = (
							await web.conversations.open({
								users: user.id,
							})
						).channel as UserOrChannel
						notificationChannels.push(channel)
					} else {
						safeLog(`Slack user not found: ${slackAuthor}`)
					}
				}
			}

			for (const channel of notificationChannels) {
				await web.chat.postMessage({
					text: message.text,
					link_names: true,
					channel: channel.id,
					as_user: true,
				})
			}
		}
	}
	if (!options.slackToken) {
		for (const message of results.logMessages) {
			safeLog(message)
		}
		for (const message of results.messages) {
			safeLog(message.text)
		}
	}
}

async function buildComplete(octokit: Octokit, owner: string, repo: string, runId: number, options: Options) {
	safeLog(`buildComplete: https://github.com/${owner}/${repo}/actions/runs/${runId}`)
	const buildResult = (
		await octokit.actions.getWorkflowRun({
			owner,
			repo,
			run_id: runId,
		})
	).data
	const parts = buildResult.workflow_url.split('/')
	const workflowId = parseInt(parts[parts.length - 1], 10)
	const build = (
		await octokit.actions.getWorkflow({
			owner,
			repo,
			workflow_id: workflowId,
		})
	).data

	const buildResults = (
		await octokit.actions.listWorkflowRuns({
			owner,
			repo,
			workflow_id: workflowId,
			branch: buildResult.head_branch || undefined,
			per_page: 5, // More returns 502s.
		})
	).data.workflow_runs.filter(
		(run) => run.status === 'completed' && conclusions.indexOf(run.conclusion || 'success') !== -1,
	)
	buildResults.sort((a, b) => -a.created_at.localeCompare(b.created_at))

	const currentBuildIndex = buildResults.findIndex((build) => build.id === buildResult.id)
	if (currentBuildIndex === -1) {
		safeLog('Build not on first page. Terminating.')
		safeLog(
			JSON.stringify(buildResults.map(({ id, status, conclusion }) => ({ id, status, conclusion }))),
		)
		throw new Error('Build not on first page. Terminating.')
	}
	const slicedResults = buildResults.slice(currentBuildIndex, currentBuildIndex + 2)
	const builds = slicedResults.map<Build>((build, i, array) => ({
		data: build,
		previousSourceVersion: i < array.length - 1 ? array[i + 1].head_sha : undefined,
		authors: [],
		buildHtmlUrl: build.html_url,
		changesHtmlUrl: '',
	}))
	const logMessages = builds
		.slice(0, 1)
		.map(
			(build) =>
				`Id: ${build.data.id} | Repository: ${owner}/${repo} | Branch: ${build.data.head_branch} | Conclusion: ${build.data.conclusion} | Created: ${build.data.created_at} | Updated: ${build.data.updated_at}`,
		)
	const transitionedBuilds = builds.filter(
		(build, i, array) => i < array.length - 1 && transitioned(build, array[i + 1]),
	)
	await Promise.all(
		transitionedBuilds.map(async (build) => {
			if (build.previousSourceVersion) {
				const cmp = await compareCommits(
					octokit,
					owner,
					repo,
					build.previousSourceVersion,
					build.data.head_sha,
				)
				const commits = cmp.data.commits
				const authors = new Set<string>([
					...commits.map((c: any) => c.author.login),
					...commits.map((c: any) => c.committer.login),
				])
				authors.delete('web-flow') // GitHub Web UI committer
				build.authors = [...authors]
				build.changesHtmlUrl = `https://github.com/${owner}/${repo}/compare/${build.previousSourceVersion.substr(
					0,
					7,
				)}...${build.data.head_sha.substr(0, 7)}` // Shorter than: cmp.data.html_url
			}
		}),
	)
	const vscode = repo === 'vscode'
	const name = vscode ? `VS Code ${build.name} Build` : build.name
	// TBD: `Requester: ${vstsToSlackUser(build.requester, build.degraded)}${pingBenForSmokeTests && releaseBuild && build.result === 'partiallySucceeded' ? ' | Ping: @bpasero' : ''}`
	const accounts = await readAccounts(options.storageConnectionString)
	const githubAccountMap = githubToAccounts(accounts)
	const messages = transitionedBuilds.map((build) => {
		const issueBody = encodeURIComponent(`Build: ${build.buildHtmlUrl}\nChanges: ${build.changesHtmlUrl}`)
		const issueTitle = encodeURIComponent('Build failure')
		const createIssueLink = `https://github.com/microsoft/vscode/issues/new?body=${issueBody}&title=${issueTitle}`
		return {
			text: `${name}
Result: ${build.data.conclusion} | Repository: ${owner}/${repo} | Branch: ${
				build.data.head_branch
			} | Authors: ${
				githubToSlackUsers(githubAccountMap, build.authors, build.degraded).sort().join(', ') ||
				`None (rebuild)`
			}
Build: ${build.buildHtmlUrl}
Create Issue: ${createIssueLink}
Changes: ${build.changesHtmlUrl}`,
			slackAuthors: build.authors.map((a) => githubAccountMap[a]?.slack).filter((a) => !!a),
		}
	})
	return { logMessages, messages }
}

const conclusions = ['success', 'failure']

function transitioned(newer: Build, older: Build) {
	const newerResult = newer.data.conclusion || 'success'
	const olderResult = older.data.conclusion || 'success'
	if (newerResult === olderResult) {
		return false
	}
	if (conclusions.indexOf(newerResult) > conclusions.indexOf(olderResult)) {
		newer.degraded = true
	}
	return true
}

async function compareCommits(octokit: Octokit, owner: string, repo: string, base: string, head: string) {
	return octokit.repos.compareCommits({ owner, repo, base, head })
}

function githubToSlackUsers(githubToAccounts: Record<string, Accounts>, githubUsers: string[], at?: boolean) {
	return githubUsers.map((g) => (githubToAccounts[g] ? `${at ? '@' : ''}${githubToAccounts[g].slack}` : g))
}

interface Accounts {
	github: string
	slack: string
	vsts: string
}

function githubToAccounts(accounts: Accounts[]) {
	return accounts.reduce((m, e) => {
		m[e.github] = e
		return m
	}, <Record<string, Accounts>>{})
}

async function readAccounts(connectionString: string | undefined) {
	if (!connectionString) {
		safeLog('Connection string missing.')
		return []
	}
	const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
	const containerClient = blobServiceClient.getContainerClient('config')
	const createContainerResponse = containerClient.getBlockBlobClient('accounts.json')
	const buf = await createContainerResponse.downloadToBuffer()
	return JSON.parse(buf.toString()) as Accounts[]
}

interface Channel {
	id: string
	name: string
	is_member: boolean
}

interface ConversationsList {
	channels: Channel[]
	response_metadata?: {
		next_cursor?: string
	}
}

async function listAllMemberships(web: WebClient) {
	let groups: ConversationsList | undefined
	const channels: Channel[] = []
	do {
		groups = ((await web.conversations.list({
			types: 'public_channel,private_channel',
			cursor: groups?.response_metadata?.next_cursor,
			limit: 100,
		})) as unknown) as ConversationsList
		channels.push(...groups.channels)
	} while (groups.response_metadata?.next_cursor)
	return channels.filter((c) => c.is_member)
}

interface Build {
	data: Octokit.ActionsListWorkflowRunsResponseWorkflowRunsItem
	previousSourceVersion: string | undefined
	authors: string[]
	buildHtmlUrl: string
	changesHtmlUrl: string
	degraded?: boolean
}
