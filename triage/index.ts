/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getInput } from '@actions/core';
import { OctoKit, OctoKitIssue } from '../api/octokit';
import { VSCodeToolsAPIManager } from '../api/vscodeTools';
import { Action, getAuthenticationToken } from '../common/Action';
import { daysAgoToHumanReadbleDate, getRequiredInput, safeLog } from '../common/utils';

class IssueTriageAction extends Action {
	id = 'IssueTriageAction';

	private async triage(issue: OctoKitIssue, skipTeamCheck = false): Promise<void> {
		try {
			const githubIssue = await issue.getIssue();
			if (!githubIssue || githubIssue.labels.includes('testplan-item')) return;
			const vscodeToolsAPI = new VSCodeToolsAPIManager();
			const teamMembers = new Set((await vscodeToolsAPI.getTeamMembers()).map((t) => t.id));
			if (!skipTeamCheck && teamMembers.has(githubIssue.author.name)) {
				if (githubIssue.assignees.length === 0) {
					const link = getInput('workingAreasLink');
					if (link) {
						await issue.postComment(
							`Hi @${githubIssue.author.name}. As a member of the team, you can help us triage this issue by referring to ${link}`,
						);
					} else {
						await issue.postComment(
							`Hi @${githubIssue.author.name}. You can help us triage this issue by assigning it to the appropriate person.`,
						);
					}
				}
				safeLog('Author is a team member, skipping triaging', githubIssue.author.name);
				return;
			}

			// check to see that issue is not already assigned
			if (githubIssue.assignees.length > 0) {
				return;
			}

			await issue.addLabel('triage-needed');
			const assignees: string[] = getRequiredInput('assignees').split('|');

			if (assignees.length === 0) {
				safeLog('No assignees provided');
				return;
			}

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
		// wait 1 minute before triaging
		await new Promise((resolve) => setTimeout(resolve, 60000));
		await this.triage(issue);
	}

	protected override async onTriggered(_octokit: OctoKit): Promise<void> {
		const owner = getRequiredInput('owner');
		const repo = getRequiredInput('repo');
		const token = await getAuthenticationToken();

		const staleIssues = _octokit.query({
			q: `is:issue is:open no:assignee no:label updated:<${daysAgoToHumanReadbleDate(7)}`,
		});

		// Loop through issues which are not assigned and no labels and updated more than 7 days ago
		for await (const page of staleIssues) {
			for (const issueData of page) {
				const issue = await issueData.getIssue();
				if (!issue) continue;
				const octokitIssue = new OctoKitIssue(token, { owner, repo }, { number: issue?.number });
				await this.triage(octokitIssue, true);
			}
		}
		safeLog('Completed triaging stale issues.');
	}
}

new IssueTriageAction().run(); // eslint-disable-line
