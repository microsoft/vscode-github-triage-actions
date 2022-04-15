/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OctoKitIssue } from '../api/octokit';
import { getRequiredInput } from '../common/utils';
import { TestPlanItemValidator } from './TestPlanitemValidator';
import { Action } from '../common/Action';

class TestPlanItemValidatorAction extends Action {
	id = 'TestPlanItemValidator';

	async runValidation(issue: OctoKitIssue) {
		await new TestPlanItemValidator(
			issue,
			getRequiredInput('label'),
			getRequiredInput('invalidLabel'),
			getRequiredInput('comment'),
		).run();
	}

	async onLabeled(issue: OctoKitIssue) {
		await this.runValidation(issue);
	}

	async onEdited(issue: OctoKitIssue) {
		await this.runValidation(issue);
	}
}

new TestPlanItemValidatorAction().run() // eslint-disable-line
