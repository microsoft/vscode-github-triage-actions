/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Octokit } from '@octokit/rest';
import { Comment, GitHubIssue, Issue } from '../api/api';
import { safeLog } from '../common/utils';
import { parseTestPlanItem } from './validator';

const commentTag = '<!-- INVALID TEST PLAN ITEM -->';

export class TestPlanItemValidator {
	constructor(
		private github: GitHubIssue,
		private token: string,
		private refLabel: string,
		private label: string,
		private invalidLabel: string,
		private comment: string,
	) {}

	async run() {
		const issue = await this.github.getIssue();
		if (!issue) return;

		const shouldAddErrors = issue.labels.includes(this.label) || issue.labels.includes(this.invalidLabel);
		const madeByTeamMember = await this.github.hasWriteAccess(issue.author.name);

		if (!madeByTeamMember) {
			safeLog('Issue not made by team member, skipping validation');
			return;
		}

		const tasks: Promise<void>[] = [];

		let priorComments: Comment[] | undefined = undefined;
		for await (const page of this.github.getComments()) {
			priorComments = page.filter((comment) => comment.body.indexOf(commentTag) !== -1);
			if (priorComments) {
				safeLog('Found prior comment. Deleting.');
				tasks.push(...priorComments.map((comment) => this.github.deleteComment(comment.id)));
			}
			break;
		}

		const errors = await this.getErrors(issue);
		if (errors) {
			if (shouldAddErrors) {
				tasks.push(this.github.postComment(`${commentTag}\n${this.comment}\n\n**Error:** ${errors}`));
				tasks.push(this.github.addLabel(this.invalidLabel));
				tasks.push(this.github.removeLabel(this.label));
			}
		} else {
			safeLog('Valid testplan item found!');
			tasks.push(this.github.removeLabel(this.invalidLabel));
			tasks.push(this.github.addLabel(this.label));
		}

		await Promise.all(tasks);
	}

	private async getErrors(issue: Issue): Promise<string | undefined> {
		try {
			const testPlan = parseTestPlanItem(issue.body, issue.author.name);
			if (testPlan.issueRefs.length) {
				// In the case of testing we don't test this due to the complexity of the API.
				if (!this.token) {
					return;
				}
				const octokit = new Octokit({ auth: this.token });
				for (const referencedIssue of testPlan.issueRefs) {
					if (typeof referencedIssue === 'number') {
						await octokit.issues.addLabels({
							owner: this.github.repoOwner,
							repo: this.github.repoName,
							issue_number: referencedIssue,
							labels: [this.refLabel],
						});
					} else {
						// If referenced issue is a string, it's a gh url so we need to extract the owner, repo, and issue number
						const urlParts = referencedIssue.split('/');
						const owner = urlParts[3];
						const repo = urlParts[4];
						const issueNumber = parseInt(urlParts[6]);
						await octokit.issues.addLabels({
							owner,
							repo,
							issue_number: issueNumber,
							labels: [this.refLabel],
						});
					}
				}
			}
			const currentMilestone = issue.milestone;
			if (currentMilestone === null) {
				const currentRepoMilestone = await this.github.getCurrentRepoMilestone();
				if (currentRepoMilestone) {
					await this.github.setMilestone(currentRepoMilestone);
				}
			}
			return;
		} catch (error) {
			const err = error as Error;
			return err.message;
		}
	}
}
