/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OctoKitIssue } from '../api/octokit'
import { getRequiredInput } from '../common/utils'
import { AddExtraLabel } from './addExtraLabel'
import { Action } from '../common/Action'

class AddExtraLabelAction extends Action {
	id = 'AddExtraLabel'

	async onOpened(issue: OctoKitIssue) {
		await new AddExtraLabel(issue, getRequiredInput('newLabel')).run()
	}
}

new AddExtraLabelAction().run() // eslint-disable-line
