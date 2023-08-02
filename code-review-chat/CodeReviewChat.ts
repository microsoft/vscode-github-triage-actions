/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Octokit } from '@octokit/rest';
import { WebClient } from '@slack/web-api';
import { GitHubIssue } from '../api/api';
import { OctoKitIssue } from '../api/octokit';
import { safeLog } from '../common/utils';
import { VSCodeToolsAPIManager } from '../api/vscodeTools';

interface PR {
	number: number;
	body: string;
	additions: number;
	deletions: number;
	changed_files: number;
	url: string;
	owner: string;
	draft: boolean;
	/**
	 * The branch you're merging into i.e main
	 */
	baseBranchName: string;
	/**
	 * The branch the PR is created from i.e. feature/foo
	 */
	headBranchName: string;
	title: string;
}

// Some slack typings since the API isn't the best in terms of typings
interface SlackReaction {
	name: string;
	count: number;
	users: string[];
}

interface SlackMessage {
	type: 'message';
	// Tombstone if deleted, channel_join if it's a join message.
	subtype: 'tombstone' | 'channel_join' | undefined;
	text: string;
	reply_count?: number;
	ts: string;
	reactions?: SlackReaction[];
}

export interface Options {
	slackToken: string;
	codereviewChannel: string;
	payload: {
		owner: string;
		repo: string;
		repo_full_name: string;
		repo_url: string | undefined;
		pr: PR;
	};
}

class Chatter {
	constructor(protected slackToken: string, protected notificationChannel: string) {}

	async getChat(): Promise<{ client: WebClient; channel: string }> {
		const web = new WebClient(this.slackToken);
		const memberships = await listAllMemberships(web);

		const codereviewChannel =
			this.notificationChannel && memberships.find((m) => m.name === this.notificationChannel);

		if (!codereviewChannel) {
			throw Error(`Slack channel not found: ${this.notificationChannel}`);
		}
		return { client: web, channel: codereviewChannel.id };
	}
}

export class CodeReviewChatDeleter extends Chatter {
	private elevatedClient: WebClient | undefined;
	constructor(
		slackToken: string,
		slackElevatedUserToken: string | undefined,
		notificationChannel: string,
		private prUrl: string,
	) {
		super(slackToken, notificationChannel);
		this.elevatedClient = slackElevatedUserToken ? new WebClient(slackElevatedUserToken) : undefined;
	}

	async run() {
		const { client, channel } = await this.getChat();
		// Get the last 20 messages (don't bother looking further than that)
		const response = await client.conversations.history({
			channel,
			limit: 20,
		});
		if (!response.ok || !response.messages) {
			throw Error('Error getting channel history');
		}
		const messages = response.messages as SlackMessage[];

		const messagesToDelete = messages.filter((message) => {
			const isCodeReviewMessage = message.text.includes(this.prUrl);
			// If it has a subtype it means its a special slack message which we want to delete
			if (message.subtype) {
				return true;
			}
			const hasWhiteCheckMark = message.reactions?.some(
				(reaction) => reaction.name === 'white_check_mark',
			);
			// Extract PR URL from the chat message. It is in the form https://https://github.com/{repo}/pull/{number}
			const prUrl = message.text.match(/https:\/\/github.com\/.*\/pull\/\d+/)?.[0] ?? '';
			if (isCodeReviewMessage) {
				safeLog(`${prUrl} was closed or met review threshold. Deleting the message.`);
			}
			if (this.elevatedClient && message.reactions) {
				if (hasWhiteCheckMark) {
					safeLog(`Message ${prUrl} has a check mark reaction, deleting it.`);
				}
				// If we have an elevated client we can delete the message as long it has a "white_check_mark" reaction
				return isCodeReviewMessage || hasWhiteCheckMark;
			}
			return isCodeReviewMessage;
		});

		// Delete all the replies to messages queued for deletion
		const replies: SlackMessage[] = [];
		for (const message of messagesToDelete) {
			// If reply count is greater than 1 we must fetch the replies
			if (message.reply_count) {
				const replyThread = await client.conversations.replies({
					channel,
					ts: message.ts,
				});
				if (!replyThread.ok || !replyThread.messages) {
					safeLog('Error getting messages replies');
				} else {
					// Pushback everything but the first reply since the first reply is the original message
					replies.push(...(replyThread.messages as SlackMessage[]).slice(1));
				}
			}
		}
		messagesToDelete.push(...replies);

		if (messagesToDelete.length === 0) {
			safeLog('no message found, exiting');
			return;
		}
		try {
			// Attempt to use the correct client to delete the messages
			for (const message of messagesToDelete) {
				// Can't delete already deleted messages.
				// The reason they're in the array is so we can get their replies
				if (message.subtype === 'tombstone') {
					continue;
				}
				if (this.elevatedClient) {
					await this.elevatedClient.chat.delete({
						channel,
						ts: message.ts,
						as_user: true,
					});
				} else {
					await client.chat.delete({
						channel,
						ts: message.ts,
					});
				}
			}
		} catch (e: any) {
			safeLog(`Error deleting message: ${e.message}`);
		}
	}
}

export class CodeReviewChat extends Chatter {
	private pr: PR;
	constructor(
		private octokit: Octokit,
		private toolsAPI: VSCodeToolsAPIManager,
		private issue: GitHubIssue,
		private options: Options,
		private readonly _externalContributorPR?: boolean,
	) {
		super(options.slackToken, options.codereviewChannel);
		this.pr = options.payload.pr;
	}

	private async postMessage(message: string) {
		const { client, channel } = await this.getChat();

		await client.chat.postMessage({
			text: message,
			channel,
			link_names: true,
		});
	}

	private async postExternalPRMessage() {
		const requestedReviewersAPIResponse = await this.octokit.pulls.listRequestedReviewers({
			owner: this.options.payload.owner,
			repo: this.options.payload.repo,
			pull_number: this.options.payload.pr.number,
		});
		const requestedReviewers = requestedReviewersAPIResponse.data.users.map((user) => user.login);
		if (requestedReviewers.length !== 0) {
			safeLog('A secondary reviewer has been requested for this PR, skipping');
			return;
		}
		const message = this.getSlackMessage();
		await this.postMessage(message);
	}

	private getSlackMessage() {
		const cleanTitle = this.pr.title.replace(/`/g, '').replace('https://github.com/', '');
		const changedFilesMessage = `${this.pr.changed_files} file` + (this.pr.changed_files > 1 ? 's' : '');
		const diffMessage = `+${this.pr.additions.toLocaleString()} -${this.pr.deletions.toLocaleString()}, ${changedFilesMessage}`;
		// The message that states which repo the PR is in, only populated for non microsoft/vscode PRs
		const repoMessage =
			this.options.payload.repo_full_name === 'microsoft/vscode'
				? ':'
				: ` (in ${this.options.payload.repo_full_name}):`;

		const githubUrl = this.pr.url;
		const vscodeDevUrl = this.pr.url.replace('https://', 'https://insiders.vscode.dev/');

		const externalPrefix = this._externalContributorPR ? 'External PR: ' : '';
		const message = `${externalPrefix}*${cleanTitle}* by _${this.pr.owner}_${repoMessage} \`${diffMessage}\` <${githubUrl}|Review (GH)> | <${vscodeDevUrl}|Review (VSCode)>`;
		return message;
	}

	async run() {
		// Must request the PR again from the octokit api as it may have changed since creation
		const prFromApi = (
			await this.octokit.pulls.get({
				pull_number: this.pr.number,
				owner: this.options.payload.owner,
				repo: this.options.payload.repo,
			})
		).data;
		if (prFromApi.draft) {
			safeLog('PR is draft, ignoring');
			return;
		}

		// A small set of repos which we don't want to be posted
		const ignoredRepos = ['vscode-extensions-loc', 'vscode-loc-drop'];
		// Ignore PRs from ignored repos
		if (ignoredRepos.includes(this.options.payload.repo)) {
			safeLog('PR is from ignored repo, ignoring');
			return;
		}

		// TODO @lramos15 possibly make this configurable
		if (this.pr.baseBranchName.startsWith('release')) {
			safeLog('PR is on a release branch, ignoring');
			return;
		}

		// This is an external PR which already received one review and is just awaiting a second
		if (this._externalContributorPR) {
			await this.postExternalPRMessage();
			return;
		}

		const data = await this.issue.getIssue();
		const teamMembers = new Set((await this.toolsAPI.getTeamMembers()).map((t) => t.id));
		const author = data.author;
		// Author must have write access to the repo or be a bot
		if ((!teamMembers.has(author.name) && !author.isGitHubApp) || author.name.includes('dependabot')) {
			safeLog('Issue author not team member, ignoring');
			return;
		}
		const tasks = [];

		if (!data.assignee && !author.isGitHubApp) {
			tasks.push(this.issue.addAssignee(author.name));
		}

		tasks.push(
			(async () => {
				const currentMilestone = await this.issue.getCurrentRepoMilestone();
				if (!data.milestone && currentMilestone) {
					await this.issue.setMilestone(currentMilestone);
				}
			})(),
		);

		tasks.push(
			(async () => {
				const [hasExistingReview, existingRequests] = await Promise.all([
					meetsReviewThreshold(
						this.octokit,
						teamMembers,
						this.options.payload.pr.number,
						this.options.payload.repo,
						this.options.payload.owner,
						this.issue,
					),
					this.octokit.pulls.listRequestedReviewers({
						owner: this.options.payload.owner,
						repo: this.options.payload.repo,
						pull_number: this.options.payload.pr.number,
					}),
				]);

				// Check to see if there is an existing review or review request. We don't check if the author is part of the review request as that isn't possible
				const hasExisting = hasExistingReview || existingRequests?.data?.users?.length;
				if (hasExisting) {
					safeLog('had existing review requests, exiting');
					process.exit(0);
				}

				const message = this.getSlackMessage();
				safeLog(message);
				await this.postMessage(message);
			})(),
		);

		await Promise.all(tasks);
	}
}

interface Channel {
	id: string;
	name: string;
	is_member: boolean;
}

interface ConversationsList {
	channels: Channel[];
	response_metadata?: {
		next_cursor?: string;
	};
}

export async function getTeamMemberReviews(
	octokit: Octokit,
	teamMembers: Set<string>,
	prNumber: number,
	repo: string,
	owner: string,
	ghIssue: GitHubIssue | OctoKitIssue,
) {
	const reviews = await octokit.pulls.listReviews({
		pull_number: prNumber,
		owner,
		repo,
	});
	// Get author of PR
	const author = (await ghIssue.getIssue()).author.name;
	// Get timestamp of last commit
	const lastCommitTimestamp = (
		await octokit.pulls.listCommits({
			pull_number: prNumber,
			owner,
			repo,
		})
	).data[0]?.commit?.committer?.date;
	// Convert date string into unix timestamp
	const lastCommitUnixTimestamp = lastCommitTimestamp ? new Date(lastCommitTimestamp).getTime() : 0;
	// Get all reviews that are from team members, excluding the author
	const teamMemberReviews = [];
	for (const review of reviews.data) {
		if (!review.user || !review.user.name) {
			continue;
		}
		if (review.user.name === author || review.user.login === author) {
			continue;
		}
		const reviewTimestamp = review.submitted_at ? new Date(review.submitted_at).getTime() : 0;
		// Check that the review occured after the last commit
		if (reviewTimestamp < lastCommitUnixTimestamp) {
			continue;
		}
		const isTeamMember = teamMembers.has(review.user.login);
		if (isTeamMember) {
			teamMemberReviews.push(review);
		}
		return teamMemberReviews;
	}
}

export async function meetsReviewThreshold(
	octokit: Octokit,
	teamMembers: Set<string>,
	prNumber: number,
	repo: string,
	owner: string,
	ghIssue: GitHubIssue | OctoKitIssue,
) {
	// Get author of PR
	const author = (await ghIssue.getIssue()).author.name;
	const teamMemberReviews = await getTeamMemberReviews(
		octokit,
		teamMembers,
		prNumber,
		repo,
		owner,
		ghIssue,
	);
	// While more expensive to convert from Array -> Set -> Array, we want to ensure the same name isn't double counted if a user has multiple reviews
	const reviewerNames = Array.from(new Set(teamMemberReviews?.map((r) => r.user?.login ?? 'Unknown')));
	let meetsReviewThreshold = false;
	// Team members require 1 review, external requires two
	if (teamMembers.has(author)) {
		meetsReviewThreshold = reviewerNames.length >= 1;
	} else {
		meetsReviewThreshold = reviewerNames.length >= 2;
	}
	// Some more logging to help diagnose issues
	if (meetsReviewThreshold) {
		safeLog(`Met review threshold: ${reviewerNames.join(', ')}`);
	}
	return meetsReviewThreshold;
}

async function listAllMemberships(web: WebClient) {
	let groups: ConversationsList | undefined;
	const channels: Channel[] = [];
	do {
		try {
			groups = (await web.conversations.list({
				types: 'public_channel,private_channel',
				cursor: groups?.response_metadata?.next_cursor,
				limit: 100,
			})) as unknown as ConversationsList;
			channels.push(...groups.channels);
		} catch (err) {
			safeLog(`Error listing channels: ${err}`);
			groups = undefined;
		}
	} while (groups?.response_metadata?.next_cursor);
	return channels.filter((c) => c.is_member);
}
