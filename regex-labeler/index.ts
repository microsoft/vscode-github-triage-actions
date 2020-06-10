/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { context } from '@actions/github'
import { OctoKitIssue } from '../api/octokit'
import { getInput, getRequiredInput } from '../common/utils'
import { RegexFlagger } from './RegexLabeler'
import { Action } from '../common/Action'

class RegexFlaggerActon extends Action {
	id = 'RegexFlagger'
	async onOpened() {
		await new RegexFlagger(
			new OctoKitIssue(getRequiredInput('token'), context.repo, { number: context.issue.number }),
			getInput('label'),
			getInput('comment'),
			getInput('mustMatch'),
			getInput('mustNotMatch'),
		).run()
	}
}

new RegexFlaggerActon().run() // eslint-disable-line