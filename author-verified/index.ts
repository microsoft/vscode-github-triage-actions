/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as core from '@actions/core'
import { context } from '@actions/github'
import { OctoKit, OctoKitIssue } from '../api/octokit'
import { getRequiredInput, logErrorToIssue, logRateLimit } from '../utils/utils'
import { AuthorVerifiedLabeler, AuthorVerifiedQueryer } from './AuthorVerified'

const main = async () => {
	if (context.eventName === 'repository_dispatch' && context.payload.action !== 'trigger_author_verified') {
		return
	}

	const token = getRequiredInput('token')
	const requestVerificationComment = getRequiredInput('requestVerificationComment')
	const pendingReleaseLabel = getRequiredInput('pendingReleaseLabel')
	const authorVerificationRequestedLabel = getRequiredInput('authorVerificationRequestedLabel')

	if (context.eventName === 'schedule' || context.eventName === 'repository_dispatch') {
		await new AuthorVerifiedQueryer(
			new OctoKit(token, context.repo),
			requestVerificationComment,
			pendingReleaseLabel,
			authorVerificationRequestedLabel,
		).run()
	} else if (context.eventName === 'issues') {
		if (
			context.payload.action === 'closed' ||
			context.payload.label.name === authorVerificationRequestedLabel
		) {
			await new AuthorVerifiedLabeler(
				new OctoKitIssue(token, context.repo, { number: context.issue.number }),
				requestVerificationComment,
				pendingReleaseLabel,
				authorVerificationRequestedLabel,
			).run()
		}
	}
}

main()
	.then(logRateLimit)
	.catch(async (error) => {
		core.setFailed(error.message)
		await logErrorToIssue(error.message, true)
	})
