/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { context } from '@actions/github'
import { getRequiredInput, getInput } from '../../../common/utils'
import { download } from './download'
import { createDataDirectories } from './createDataDir'
import { statSync } from 'fs'
import { join } from 'path'
import { Action } from '../../../common/Action'

const token = getRequiredInput('token')
const endCursor = getInput('cursor')

const areas = getRequiredInput('areas').split('|')
const assignees = getRequiredInput('assignees').split('|')

class FetchIssues extends Action {
	id = 'Classifier/Train/FetchIssues'

	async onTriggered() {
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
}

new FetchIssues().run() // eslint-disable-line