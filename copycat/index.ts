/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OctoKitIssue } from '../api/octokit'
import { getRequiredInput } from '../common/utils'
import { CopyCat } from './CopyCat'
import { Action } from '../common/Action'

class CopyCatAction extends Action {
	id = 'CopyCat'

	async onOpened(issue: OctoKitIssue) {
		await new CopyCat(issue, getRequiredInput('owner'), getRequiredInput('repo')).run()
	}
}

new CopyCatAction().run() // eslint-disable-line
