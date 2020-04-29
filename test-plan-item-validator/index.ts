/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as core from '@actions/core'
import { context } from '@actions/github'
import { OctoKitIssue } from '../api/octokit'
import { getRequiredInput, logErrorToIssue, logRateLimit } from '../utils/utils'
import { TestPlanItemValidator } from './TestPlanitemValidator'

const main = async () => {
	await new TestPlanItemValidator(
		new OctoKitIssue(getRequiredInput('token'), context.repo, { number: context.issue.number }),
		getRequiredInput('label'),
		getRequiredInput('invalidLabel'),
		getRequiredInput('comment'),
	).run()
}

main()
	.then(() => logRateLimit(getRequiredInput('token')))
	.catch(async (error) => {
		core.setFailed(error.message)
		await logErrorToIssue(error, true, getRequiredInput('token'))
	})
