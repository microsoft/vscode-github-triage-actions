/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GitHub } from '../api/api';
import { daysAgoToHumanReadbleDate, daysAgoToTimestamp, safeLog } from '../common/utils';

export class NeedsMoreInfoCloser {
	constructor(
		private github: GitHub,
		private label: string,
		private closeDays: number,
		private pingDays: number,
		private closeComment: string,
		private pingComment: string,
		private additionalTeam: string[],
	) {}

	async run() {
		const updatedTimestamp = daysAgoToHumanReadbleDate(this.closeDays);
		const pingTimestamp = daysAgoToTimestamp(this.pingDays);

		const query = `repo:${this.github.repoOwner}/${this.github.repoName} updated:<${updatedTimestamp} label:"${this.label}" is:open is:unlocked`;

		for await (const page of this.github.query({ q: query })) {
			for (const issue of page) {
				const hydrated = await issue.getIssue();
				const lastCommentIterator = await issue.getComments(true).next();
				if (lastCommentIterator.done) {
					throw Error('Unexpected comment data');
				}
				const lastComment = lastCommentIterator.value[0];

				if (
					hydrated.open &&
					hydrated.labels.includes(this.label)
					// TODO: Verify updated timestamp
				) {
					if (
						!lastComment ||
						lastComment.author.isGitHubApp ||
						// TODO: List the collaborators once per go rather than checking a single user each issue
						this.additionalTeam.includes(lastComment.author.name) ||
						(await issue.hasWriteAccess(lastComment.author.name))
					) {
						if (lastComment) {
							safeLog(`Last comment on ${hydrated.number} by team. Closing.`);
						} else {
							safeLog(`No comments on ${hydrated.number}. Closing.`);
						}
						if (this.closeComment) {
							await issue.postComment(this.closeComment);
						}
						await issue.closeIssue('not_planned');
					} else {
						if (hydrated.updatedAt < pingTimestamp && hydrated.assignee) {
							safeLog(
								`Last comment on ${hydrated.number} by rando. Pinging @${hydrated.assignee}`,
							);
							if (this.pingComment) {
								await issue.postComment(
									this.pingComment
										.replace(
											'${assignee}',
											hydrated.assignees?.join(' @') || hydrated.assignee,
										)
										.replace('${author}', hydrated.author.name),
								);
							}
						} else {
							safeLog(
								`Last comment on ${hydrated.number} by rando. Skipping.${
									hydrated.assignee ? ' cc @' + hydrated.assignee : ''
								}`,
							);
						}
					}
				} else {
					safeLog('Query returned an invalid issue:' + hydrated.number);
				}
			}
		}
	}
}
