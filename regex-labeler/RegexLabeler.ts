/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GitHubIssue } from '../api/api'

export class RegexFlagger {
	constructor(
		private github: GitHubIssue,
		private label: string | undefined,
		private comment: string | undefined,
		private mustMatch: string | undefined,
		private mustNotMatch: string | undefined,
	) {}

	async run() {
		const issue = await this.github.getIssue()
		const stripped = issue.body.replace(/<!--.*?-->/g, '')
		if (
			(this.mustNotMatch && new RegExp(this.mustNotMatch, 'i').test(stripped)) ||
			(this.mustMatch && !new RegExp(this.mustMatch, 'i').test(stripped))
		) {
			console.log('Flagging')
			if (this.label) {
				await this.github.addLabel(this.label)
			}
			if (this.comment) {
				await this.github.postComment(this.comment)
			}
			await this.github.closeIssue()
		}
	}
}
