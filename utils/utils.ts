/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as core from '@actions/core'
import { context, GitHub } from '@actions/github'
import axios from 'axios'
import { OctoKitIssue } from '../api/octokit'

export const getInput = (name: string) => core.getInput(name) || undefined
export const getRequiredInput = (name: string) => core.getInput(name, { required: true })

export interface Release {
	productVersion: string
	timestamp: number
	version: string
}

export const loadLatestRelease = async (quality: 'stable' | 'insider'): Promise<Release | undefined> =>
	(await axios.get(`https://vscode-update.azurewebsites.net/api/update/darwin/${quality}/latest`)).data

export const daysAgoToTimestamp = (days: number): number => +new Date(Date.now() - days * 24 * 60 * 60 * 1000)

export const daysAgoToHumanReadbleDate = (days: number) =>
	new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}\w$/, '')

export const logRateLimit = async () => {
	const usageData = (await new GitHub(getRequiredInput('token')).rateLimit.get()).data.resources
	;(['core', 'graphql', 'search'] as const).forEach(async (category) => {
		const usage = 1 - usageData[category].remaining / usageData[category].limit
		const message = `Usage at ${usage} for ${category}`
		if (usage > 0) {
			console.log(message)
		}
		if (usage > 0.5) {
			await logErrorToIssue(message, false)
		}
	})
}

export const logErrorToIssue = async (message: string, ping: boolean): Promise<void> => {
	// Attempt to wait out abuse detection timeout if present
	await new Promise((resolve) => setTimeout(resolve, 10000))
	const dest =
		context.repo.repo === 'vscode-internalbacklog'
			? { repo: 'vscode-internalbacklog', issue: 974 }
			: { repo: 'vscode', issue: 93814 }
	return new OctoKitIssue(
		getRequiredInput('token'),
		{ owner: 'Microsoft', repo: dest.repo },
		{ number: dest.issue },
	).postComment(`
Workflow: ${context.workflow}

Error: ${message}

Issue: ${ping ? `${context.repo.owner}/${context.repo.repo}#` : ''}${context.issue.number}

Repo: ${context.repo.owner}/${context.repo.repo}

<!-- Context:
${JSON.stringify(context, null, 2).replace(/<!--/g, '<@--').replace(/-->/g, '--@>')}
-->
`)
}
