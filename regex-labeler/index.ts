/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OctoKitIssue } from '../api/octokit';
import { Action } from '../common/Action';
import { getInput } from '../common/utils';
import { RegexFlagger } from './RegexLabeler';

class RegexFlaggerActon extends Action {
	id = 'RegexFlagger';
	async onOpened(issue: OctoKitIssue) {
		await new RegexFlagger(
			issue,
			getInput('label'),
			getInput('comment'),
			getInput('mustMatch'),
			getInput('mustNotMatch'),
		).run();
	}
}

new RegexFlaggerActon().run() // eslint-disable-line