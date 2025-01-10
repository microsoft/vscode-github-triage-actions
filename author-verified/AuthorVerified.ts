/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GitHubIssue } from '../api/api';
import { loadLatestRelease } from '../common/utils';

export class AuthorVerifiedLabeler {
	constructor(
		private github: GitHubIssue,
		private comment: string,
		private releasedLabel: string,
		private authorVerificationRequestedLabel: string,
		private verifiedLabel: string,
	) {}

	private async commentVerficationRequest(comment: string) {
		const key = `<!-- AUTHOR_VERIFICATION_REQUEST -->`;

		for await (const page of this.github.getComments()) {
			for (const comment of page) {
				if (
					comment.body.includes(key) ||
					comment.body.includes('you can help us out by commenting `/verified`') // legacy
				) {
					return;
				}
			}
		}
		await this.github.postComment(`${key}\n${comment}`);
	}

	async run(): Promise<void> {
		const issue = await this.github.getIssue();
		if (!issue) return;

		if (
			!issue.open &&
			issue.labels.includes(this.authorVerificationRequestedLabel) &&
			issue.labels.includes(this.releasedLabel)
		) {
			const latestRelease = await loadLatestRelease('insider');
			if (!latestRelease) throw Error('Error loading latest release');
			if (!issue.labels.includes(this.verifiedLabel)) {
				if (issue.locked) {
					await this.github.unlockIssue();
				}
				await this.commentVerficationRequest(
					this.comment
						.replace('${commit}', latestRelease.version)
						.replace('${author}', issue.author.name),
				);
			}
		}
	}
}
