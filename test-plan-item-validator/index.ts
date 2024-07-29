/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OctoKit, OctoKitIssue } from '../api/octokit';
import { Action } from '../common/Action';
import { getRequiredInput } from '../common/utils';
import { TestPlanItemValidator } from './TestPlanitemValidator';

class TestPlanItemValidatorAction extends Action {
	id = 'TestPlanItemValidator';

	async runValidation(issue: OctoKitIssue, token?: string) {
		await new TestPlanItemValidator(
			issue,
			token ?? getRequiredInput('token'),
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

	protected override async onTriggered(_octokit: OctoKit): Promise<void> {
		// This function is only called during a manual workspace dispatch event
		// caused by a webhook, so we know to expect some inputs.
		const auth = await this.getToken();
		const repo = getRequiredInput('repo');
		const owner = getRequiredInput('owner');
		const issueNumber = +getRequiredInput('issue_number');

		const octokitIssue = new OctoKitIssue(auth, { owner, repo }, { number: issueNumber });
		await this.runValidation(octokitIssue, auth);
	}
}

new TestPlanItemValidatorAction().run() // eslint-disable-line
