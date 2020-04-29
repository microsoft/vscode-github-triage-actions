/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as core from '@actions/core'
import { context } from '@actions/github'
import { OctoKitIssue } from '../api/octokit'
import { getRequiredInput, logErrorToIssue, logRateLimit } from '../utils/utils'
import { Commands } from './Commands'

const token = getRequiredInput('token')

const main = async () => {
	const octokit = new OctoKitIssue(token, context.repo, {
		number: context.issue.number,
	})

	const commands = await octokit.readConfig(getRequiredInput('config-path'))

	const action =
		context.eventName === 'issue_comment'
			? {
					comment: context.payload.comment.body,
					user: { name: context.actor, isGitHubApp: undefined },
			  }
			: { label: context.payload.label.name }

	await new Commands(octokit, commands, action).run()
}

main()
	.then(() => logRateLimit(token))
	.catch(async (error) => {
		core.setFailed(error.message)
		await logErrorToIssue(error, true, token)
	})
