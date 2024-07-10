/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OctoKitIssue } from '../api/octokit';
import { Action } from '../common/Action';
import { getRequiredInput } from '../common/utils';
import { CopyCat } from './CopyCat';

class CopyCatAction extends Action {
	id = 'CopyCat';

	async onOpened(issue: OctoKitIssue) {
		await new CopyCat(
			issue,
			getRequiredInput('destinationOwner'),
			getRequiredInput('destinationRepo'),
		).run();
	}
}

new CopyCatAction().run() // eslint-disable-line
