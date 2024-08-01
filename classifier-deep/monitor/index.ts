/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OctoKitIssue } from '../../api/octokit';
import { Action } from '../../common/Action';
import { getRequiredInput, safeLog } from '../../common/utils';

class DeepClassifierMonitor extends Action {
	id = 'Classifier-Deep/Monitor';

	protected async onAssigned(issue: OctoKitIssue, assignee: string): Promise<void> {
		safeLog(`Assigned to ${assignee}`);
		const assigner = await issue.getAssigner(assignee);
		if (assigner !== getRequiredInput('botName')) {
			safeLog(`Assigner: ${assigner}`);
			await issue.removeLabel('triage-needed');
			await issue.removeLabel('stale');
		}
	}

	async onUnassigned(_issue: OctoKitIssue, _assignee: string) {
		// no-op
	}
}

new DeepClassifierMonitor().run() // eslint-disable-line
