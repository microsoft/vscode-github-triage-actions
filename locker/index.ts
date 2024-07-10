/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OctoKit } from '../api/octokit';
import { getInput, getRequiredInput } from '../common/utils';
import { Locker } from './Locker';
import { Action } from '../common/Action';

class LockerAction extends Action {
	id = 'Locker';

	async onTriggered(github: OctoKit) {
		await new Locker(
			github,
			+getRequiredInput('daysSinceClose'),
			+getRequiredInput('daysSinceUpdate'),
			getInput('ignoredLabel') || undefined,
			getInput('ignoreLabelUntil') || undefined,
			getInput('ignoredMilestones') || undefined,
			getInput('labelUntil') || undefined,
			getInput('typeIs') || undefined,
		).run();
	}
}

new LockerAction().run() // eslint-disable-line
