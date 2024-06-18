/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OctoKitIssue } from '../api/octokit';
import { Action } from '../common/Action';
import { ValidtyChecker } from './ValidtyChecker';

class ValidtyCheckerAction extends Action {
	id = 'ValidtyChecker';

	async onOpened(issue: OctoKitIssue) {
		await new ValidtyChecker(issue).run();
	}

	async onReopened(issue: OctoKitIssue): Promise<void> {
		await new ValidtyChecker(issue).run();
	}
}

new ValidtyCheckerAction().run() // eslint-disable-line
