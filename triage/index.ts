/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OctoKitIssue } from '../api/octokit';
import { VSCodeToolsAPIManager } from '../api/vscodeTools';
import { Action } from '../common/Action';
import { getRequiredInput, safeLog } from '../common/utils';

class IssueTriageAction extends Action {
	id = 'IssueTriageAction';

	private async triage(issue: OctoKitIssue) {
		try {
			const githubIssue = await issue.getIssue();

			// check to see that issue is not already assigned and that it does not have the triage-needed label
			if (githubIssue.assignees.length > 0 || githubIssue.labels.length > 0) {
				return;
			}

			await issue.addLabel('triage-needed');
			const assignees: string[] = getRequiredInput('assignees').split('|');

			if (assignees.length === 0) {
				safeLog('No assignees provided');
				return;
			}

			const vscodeToolsAPI = new VSCodeToolsAPIManager();
			const triagers = await vscodeToolsAPI.getTriagerGitHubIds();

			if (triagers.length === 0) {
				safeLog('No available triagers found');
				return;
			}

			const available = assignees.filter((assignee) => triagers.includes(assignee));
			if (available) {
				// Shuffle the array
				for (let i = available.length - 1; i > 0; i--) {
					const j = Math.floor(Math.random() * (i + 1));
					[available[i], available[j]] = [available[j], available[i]];
				}

				const randomSelection = available[0];
				safeLog('assigning', randomSelection);
				await issue.addAssignee(randomSelection);
			} else {
				safeLog('No available triagers');
			}
		} catch (e) {
			safeLog('Error assigning random triager', (e as any).message);
		}
	}

	protected override async onOpened(issue: OctoKitIssue): Promise<void> {
		// wait 30 seconds before triaging
		await new Promise((resolve) => setTimeout(resolve, 30000));
		await this.triage(issue);
	}
}

new IssueTriageAction().run(); // eslint-disable-line
