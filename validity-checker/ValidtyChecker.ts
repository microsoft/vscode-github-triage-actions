/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GitHubIssue } from '../api/api';
import { safeLog } from '../common/utils';

const keywords = [
	'money',
	'xbox',
	'temu',
	'instagram',
	'coupon',
	'fullclip',
	'fortnite',
	'tiktok',
	'tik-tok',
	'nintendo',
	'eshop',
	'discount codes',
	'v bucks',
	'v-bucks',
	'gift card',
	'giftcard',
	'movie',
	'viral',
	'cinema',
	'watch now',
];

export class ValidtyChecker {
	constructor(private github: GitHubIssue) {}

	async run() {
		const issue = await this.github.getIssue();
		if (!issue) return;

		safeLog(`Checking issue validty for #${issue.number}...`);
		const hasKeyword = keywords.some(
			(keyword) => issue.title.includes(keyword) || issue.body.includes(keyword),
		);

		const isBadAuthor = issue.author.name === 'ghost';
		if (hasKeyword || isBadAuthor) {
			safeLog(`Issue #${issue.number} is not a valid issue, closing...`);
			try {
				await this.github.addLabel('invalid');
				await this.github.closeIssue('not_planned');
				await this.github.lockIssue();
			} catch (e) {
				safeLog(`Failed to close issue #${issue.number}: ${e}`);
			}
		}
	}
}
