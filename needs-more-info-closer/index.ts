/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OctoKit } from '../api/octokit'
import { getInput, getRequiredInput } from '../common/utils'
import { NeedsMoreInfoCloser } from './NeedsMoreInfoCloser'
import { Action } from '../common/Action'

class NeedsMoreInfo extends Action {
	id = 'NeedsMoreInfo'

	async onTriggered(github: OctoKit) {
		await new NeedsMoreInfoCloser(
			github,
			getRequiredInput('label'),
			+getRequiredInput('closeDays'),
			+getRequiredInput('pingDays'),
			getInput('closeComment') || '',
			getInput('pingComment') || '',
			(getInput('additionalTeam') ?? '').split('|'),
		).run()
	}
}

new NeedsMoreInfo().run() // eslint-disable-line
