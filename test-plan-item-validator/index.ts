/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OctoKitIssue } from '../api/octokit';
import { Action } from '../common/Action';
import { getRequiredInput } from '../common/utils';
import { TestPlanItemValidator } from './TestPlanitemValidator';

class TestPlanItemValidatorAction extends Action {
	id = 'TestPlanItemValidator';

	async runValidation(issue: OctoKitIssue) {
		const auth = await this.getToken();
		await new TestPlanItemValidator(
			issue,
			auth ?? getRequiredInput('token'),
			getRequiredInput('refLabel'),
			getRequiredInput('label'),
			getRequiredInput('invalidLabel'),
			getRequiredInput('comment'),
		).run();
	}

	protected override async onOpened(issue: OctoKitIssue): Promise<void> {
		await this.runValidation(issue);
	}

	protected override async onLabeled(issue: OctoKitIssue) {
		await this.runValidation(issue);
	}

	protected override async onEdited(issue: OctoKitIssue) {
		await this.runValidation(issue);
	}
}

new TestPlanItemValidatorAction().run() // eslint-disable-line
