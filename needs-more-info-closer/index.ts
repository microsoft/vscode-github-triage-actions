/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as core from '@actions/core'
import { context } from '@actions/github'
import { OctoKit } from '../api/octokit'
import { getInput, getRequiredInput, logErrorToIssue, logRateLimit } from '../utils/utils'
import { NeedsMoreInfoCloser } from './NeedsMoreInfoCloser'

const token = getRequiredInput('token')

const main = async () => {
	if (
		context.eventName === 'repository_dispatch' &&
		context.payload.action !== 'trigger_needs_more_info_closer'
	) {
		return
	}

	await new NeedsMoreInfoCloser(
		new OctoKit(token, context.repo),
		getRequiredInput('label'),
		+getRequiredInput('closeDays'),
		+getRequiredInput('pingDays'),
		getInput('closeComment') || '',
		getInput('pingComment') || '',
		(getInput('additionalTeam') ?? '').split('|'),
	).run()
}

main()
	.then(() => logRateLimit(token))
	.catch(async (error) => {
		core.setFailed(error.message)
		await logErrorToIssue(error, true, token)
	})
