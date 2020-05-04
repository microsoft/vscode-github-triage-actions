/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as core from '@actions/core'
import { context } from '@actions/github'

import { logErrorToIssue, getRequiredInput } from '../../../utils/utils'
import { download } from './download'
import { createDataDirectories } from './createDataDir'

const token = getRequiredInput('token')

const run = async () => {
	await download(token, context.repo)
	await new Promise((resolve) => setTimeout(resolve, 1000))
	await createDataDirectories('category')
}

run().catch(async (error) => {
	core.setFailed(error.message)
	await logErrorToIssue(error, true, token)
})
