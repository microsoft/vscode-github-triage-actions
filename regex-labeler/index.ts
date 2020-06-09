/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as core from '@actions/core'
import { context } from '@actions/github'
import { OctoKitIssue } from '../api/octokit'
import { getInput, getRequiredInput, logErrorToIssue, logRateLimit } from '../common/utils'
import { RegexFlagger } from './RegexLabeler'

const main = async () => {
	await new RegexFlagger(
		new OctoKitIssue(getRequiredInput('token'), context.repo, { number: context.issue.number }),
		getInput('label'),
		getInput('comment'),
		getInput('mustMatch'),
		getInput('mustNotMatch'),
	).run()
}

main()
	.then(() => logRateLimit(getRequiredInput('token')))
	.catch(async (error) => {
		core.setFailed(error.message)
		await logErrorToIssue(error, true, getRequiredInput('token'))
	})
