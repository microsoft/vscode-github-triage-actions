/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as core from '@actions/core'
import { context } from '@actions/github'
import { OctoKit, OctoKitIssue } from '../api/octokit'
import { getRequiredInput, logErrorToIssue, logRateLimit } from '../utils/utils'
import { ReleasePipeline, enrollIssue, unenrollIssue } from './ReleasePipeline'

const token = getRequiredInput('token')

const main = async () => {
	const notYetReleasedLabel = getRequiredInput('notYetReleasedLabel')
	const insidersReleasedLabel = getRequiredInput('insidersReleasedLabel')

	if (context.eventName === 'issues') {
		if (context.payload.action === 'reopened') {
			await unenrollIssue(
				new OctoKitIssue(token, context.repo, { number: context.issue.number }),
				notYetReleasedLabel,
				insidersReleasedLabel,
			)
		} else {
			await enrollIssue(
				new OctoKitIssue(token, context.repo, { number: context.issue.number }),
				notYetReleasedLabel,
			)
		}
	} else {
		await new ReleasePipeline(
			new OctoKit(token, context.repo),
			notYetReleasedLabel,
			insidersReleasedLabel,
		).run()
	}
}

main()
	.then(() => logRateLimit(token))
	.catch(async (error) => {
		core.setFailed(error.message)
		await logErrorToIssue(error, true, token)
	})
