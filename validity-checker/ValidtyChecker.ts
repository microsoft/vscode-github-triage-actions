/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GitHubIssue } from '../api/api';
import { safeLog } from '../common/utils';

const keywords = ['money', 'xbox', 'tiktok', 'tik-tok'];
export class ValidtyChecker {
	constructor(private github: GitHubIssue) {}

	async run() {
		const issue = await this.github.getIssue();
		safeLog(`Checking issue validty for #${issue.number}...`);
		const hasKeyword = keywords.some(
			(keyword) => issue.title.includes(keyword) || issue.body.includes(keyword),
		);
		if (hasKeyword) {
			safeLog(`Issue #${issue.number} is not a valid issue, closing...`);
			try {
				await this.github.closeIssue('not_planned');
			} catch (e) {
				safeLog(`Failed to close issue #${issue.number}: ${e}`);
			}
		}
	}
}
