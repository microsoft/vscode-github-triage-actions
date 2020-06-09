/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as core from '@actions/core'
import { context } from '@actions/github'

import { logErrorToIssue, getRequiredInput, getInput } from '../../../common/utils'
import { download } from './download'
import { createDataDirectories } from './createDataDir'
import { statSync } from 'fs'
import { join } from 'path'

const token = getRequiredInput('token')
const endCursor = getInput('cursor')

const areas = getRequiredInput('areas').split('|')
const assignees = getRequiredInput('assignees').split('|')

const run = async () => {
	if (endCursor) {
		await download(token, context.repo, endCursor)
	} else {
		try {
			statSync(join(__dirname, 'issues.json')).isFile()
		} catch {
			await download(token, context.repo)
		}
	}
	await new Promise((resolve) => setTimeout(resolve, 1000))
	await createDataDirectories(areas, assignees)
}

run().catch(async (error) => {
	core.setFailed(error.message)
	await logErrorToIssue(error, true, token)
})
