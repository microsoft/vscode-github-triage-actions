/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OctoKitIssue } from '../api/octokit'
import { getRequiredInput } from '../common/utils'
import { NewRelease } from './NewRelease'
import { Action } from '../common/Action'

class NewReleaseAction extends Action {
	id = 'NewRelease'

	async onOpened(issue: OctoKitIssue) {
		await new NewRelease(
			issue,
			getRequiredInput('label'),
			getRequiredInput('labelColor'),
			getRequiredInput('labelDescription'),
			+getRequiredInput('days'),
		).run()
	}
}

new NewReleaseAction().run() // eslint-disable-line