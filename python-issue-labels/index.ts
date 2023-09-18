// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { context } from '@actions/github';
import { OctoKitIssue } from '../api/octokit';
import { Action } from '../common/Action';
import { getRequiredInput } from '../common/utils';

class IssueLabels extends Action {
	id = 'IssueLabels';

	async onReopened(octoKitIssue: OctoKitIssue) {
		await this.checkLabels(octoKitIssue);
	}

	async onOpened(octoKitIssue: OctoKitIssue) {
		await this.checkLabels(octoKitIssue);
	}

	private async checkLabels(octoKitIssue: OctoKitIssue) {
		const github = octoKitIssue.octokit;

		const result = await github.rest.issues.listLabelsOnIssue({
			owner: context.repo.owner,
			repo: context.repo.repo,
			issue_number: context.issue.number,
		});
		const labels = result.data.map((label) => label.name);
		const hasNeedsOrTPI = labels.some(
			(label) =>
				label.startsWith('needs') ||
				label === 'testplan-item' ||
				label.startsWith('iteration-plan') ||
				label === 'release-plan',
		);

		if (!hasNeedsOrTPI) {
			console.log(
				'This issue is not labeled with a "needs __", "iteration-plan", "release-plan", or the "testplan-item" label; add the "triage-needed" label.',
			);

			github.rest.issues.addLabels({
				owner: context.repo.owner,
				repo: context.repo.repo,
				issue_number: context.issue.number,
				labels: ['triage-needed'],
			});
		} else {
			console.log(
				'This issue already has a "needs __", "iteration-plan", "release-plan", or the "testplan-item" label, do not add the "triage-needed" label.',
			);
		}
		const knownTriagers = JSON.parse(getRequiredInput('triagers'));
		const currentAssignees = await github.rest.issues
			.get({
				owner: context.repo.owner,
				repo: context.repo.repo,
				issue_number: context.issue.number,
			})
			.then((result) => result.data.assignees!.map((a) => a.login));
		console.log('Known triagers:', JSON.stringify(knownTriagers));
		console.log('Current assignees:', JSON.stringify(currentAssignees));
		const assigneesToRemove = currentAssignees.filter((a) => !knownTriagers.includes(a));
		console.log('Assignees to remove:', JSON.stringify(assigneesToRemove));
		github.rest.issues.removeAssignees({
			owner: context.repo.owner,
			repo: context.repo.repo,
			issue_number: context.issue.number,
			assignees: assigneesToRemove,
		});
	}
}

new IssueLabels().run(); // eslint-disable-line
