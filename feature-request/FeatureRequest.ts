/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GitHubIssue } from '../api/api';

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
		if (issue.open && issue.milestone?.milestoneId === this.milestone) {
			await this.github.postComment(CREATE_MARKER + '\n' + this.comment);
		}
	}
}
