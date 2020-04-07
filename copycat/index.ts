/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as core from '@actions/core'
import { context } from '@actions/github'
import { OctoKitIssue } from '../api/octokit'
import { getRequiredInput, logErrorToIssue, logRateLimit } from '../utils/utils'
import { CopyCat } from './CopyCat'

const main = async () => {
	await new CopyCat(
		new OctoKitIssue(getRequiredInput('token'), context.repo, { number: context.issue.number }),
		getRequiredInput('owner'),
		getRequiredInput('repo'),
	).run()
}

main()
	.then(logRateLimit)
	.catch(async (error) => {
		core.setFailed(error.message)
		await logErrorToIssue(error.message, true)
	})
