/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as core from '@actions/core'
import { context } from '@actions/github'
import { logErrorToIssue, logRateLimit, getRequiredInput } from '../utils/utils'

const main = async () => {
	// Get the JSON webhook payload for the event that triggered the workflow
	const payload = JSON.stringify(context, undefined, 2)
	console.log(`The event payload: ${payload}`)
}

main()
	.then(() => logRateLimit(getRequiredInput('token')))
	.catch(async (error) => {
		core.setFailed(error.message)
		await logErrorToIssue(error, true, getRequiredInput('token'))
	})
