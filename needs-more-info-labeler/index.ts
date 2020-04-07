/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as core from '@actions/core'
import { context } from '@actions/github'
import { OctoKitIssue } from '../api/octokit'
import { getInput, getRequiredInput, logErrorToIssue, logRateLimit } from '../utils/utils'
import { NeedsMoreInfoLabeler } from './NeedsMoreInfoLabeler'

const main = async () => {
	await new NeedsMoreInfoLabeler(
		new OctoKitIssue(getRequiredInput('token'), context.repo, { number: context.issue.number }),
		getRequiredInput('label'),
		getRequiredInput('comment'),
		getRequiredInput('matcher'),
		getInput('tags'),
		getRequiredInput('bots').split('|'),
		!!getInput('flag-team'),
	).run()
}

main()
	.then(logRateLimit)
	.catch(async (error) => {
		core.setFailed(error.message)
		await logErrorToIssue(error.message, true)
	})
