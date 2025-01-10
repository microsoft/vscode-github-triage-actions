/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GitHub, GitHubIssue } from '../api/api';
import { safeLog } from '../common/utils';

export const CREATE_MARKER = '<!-- 6d457af9-96bd-47a8-a0e8-ecf120dfffc1 -->'; // do not change, this is how we find the comments the bot made when assigning the issue was assigned to the candidate milestone
export const WARN_MARKER = '<!-- 7e568b0a-a7ce-58b9-b1f9-fd0231e000d2 -->'; // do not change, this is how we find the comments the bot made when writing a warning message
export const REJECT_MARKER = '<!-- 8f679c1b-b8df-69ca-c20a-0e1342f111e3 -->'; // do not change, this is how we find the comments the bot made when rejecting an issue
export const ACCEPT_MARKER = '<!-- 9078ab2c-c9e0-7adb-d31b-1f23430222f4 -->'; // do not change, this is how we find the comments the bot made when accepting an issue

export type FeatureRequestConfig = {
	milestones: { candidateID: number; backlogID?: number; candidateName: string };
	featureRequestLabel: string;
	upvotesRequired: number;
	numCommentsOverride: number;
	labelsToExclude: string[];
	comments: { init?: string; warn: string; accept?: string; reject: string; rejectLabel?: string };
	delays: { warn: number; close: number };
};

export class FeatureRequestQueryer {
	constructor(private github: GitHub, private config: FeatureRequestConfig) {}

	async run(): Promise<void> {
		let query = `repo:${this.github.repoOwner}/${this.github.repoName} is:open is:issue milestone:"${this.config.milestones.candidateName}" label:"${this.config.featureRequestLabel}"`;
		query += this.config.labelsToExclude.map((l) => `-label:"${l}"`).join(' ');
		for await (const page of this.github.query({ q: query })) {
			for (const issue of page) {
				const issueData = await issue.getIssue();
				if (!issueData) continue;

				if (
					issueData.open &&
					issueData.milestone?.milestoneId === this.config.milestones.candidateID &&
					issueData.labels.includes(this.config.featureRequestLabel) &&
					!issueData.labels.some((issueLabel) =>
						this.config.labelsToExclude.some((excludeLabel) => issueLabel === excludeLabel),
					)
				) {
					await this.actOn(issue);
				} else {
					safeLog('Query returned an invalid issue:', issueData.number);
				}
			}
		}
	}

	private async actOn(issue: GitHubIssue): Promise<void> {
		const issueData = await issue.getIssue();
		if (!issueData) return;

		if (!issueData.reactions) throw Error('No reaction data in issue ' + JSON.stringify(issueData));

		if (
			issueData.reactions['+1'] >= this.config.upvotesRequired &&
			this.config.comments.accept &&
			this.config.milestones.backlogID
		) {
			safeLog(`Issue #${issueData.number} sucessfully promoted`);
			await Promise.all([
				issue.setMilestone(this.config.milestones.backlogID),
				issue.postComment(ACCEPT_MARKER + '\n' + this.config.comments.accept),
			]);
		} else if (issueData.numComments < this.config.numCommentsOverride) {
			const state: {
				initTimestamp?: number;
				warnTimestamp?: number;
			} = {};
			for await (const page of issue.getComments()) {
				for (const comment of page) {
					if (comment.body.includes(CREATE_MARKER)) {
						state.initTimestamp = comment.timestamp;
					}
					if (comment.body.includes(WARN_MARKER)) {
						state.warnTimestamp = comment.timestamp;
					}
				}
			}
			if (!state.initTimestamp) {
				if (this.config.comments.init) {
					await new FeatureRequestOnMilestone(
						issue,
						this.config.comments.init,
						this.config.milestones.candidateID,
					).run();
				}
			} else if (!state.warnTimestamp) {
				if (
					this.daysSince(state.initTimestamp) >
					this.config.delays.close - this.config.delays.warn
				) {
					safeLog(`Issue #${issueData.number} nearing rejection`);
					await issue.postComment(WARN_MARKER + '\n' + this.config.comments.warn);
				}
			} else if (this.daysSince(state.warnTimestamp) > this.config.delays.warn) {
				safeLog(`Issue #${issueData.number} rejected`);
				await issue.postComment(REJECT_MARKER + '\n' + this.config.comments.reject);
				await issue.closeIssue('not_planned');

				if (this.config.comments.rejectLabel) {
					await issue.addLabel(this.config.comments.rejectLabel);
				}
			}
		} else {
			safeLog(`Issue #${issueData.number} has hot discussion. Ignoring.`);
		}
	}

	private daysSince(timestamp: number) {
		return (Date.now() - timestamp) / 1000 / 60 / 60 / 24;
	}
}

export class FeatureRequestOnLabel {
	constructor(
		private github: GitHubIssue,
		private delay: number,
		private milestone: number,
		private label: string,
	) {}

	async run(): Promise<void> {
		await new Promise((resolve) => setTimeout(resolve, this.delay * 1000));

		const issue = await this.github.getIssue();
		if (!issue) return;

		if (
			!issue.open ||
			issue.milestone?.milestoneId ||
			!issue.labels.includes(this.label) ||
			(await this.github.hasWriteAccess(issue.author.name))
		) {
			return;
		}

		return this.github.setMilestone(this.milestone);
	}
}

export class FeatureRequestOnMilestone {
	constructor(private github: GitHubIssue, private comment: string, private milestone: number) {}

	async run(): Promise<void> {
		const issue = await this.github.getIssue();
		if (!issue) return;

		if (issue.open && issue.milestone?.milestoneId === this.milestone) {
			await this.github.postComment(CREATE_MARKER + '\n' + this.comment);
		}
	}
}
