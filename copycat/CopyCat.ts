/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GitHubIssue } from '../api/api'
import { safeLog } from '../common/utils'

export class CopyCat {
	constructor(private github: GitHubIssue, private owner: string, private repo: string) {}

	async run() {
		const issue = await this.github.getIssue()
		safeLog(`Mirroring issue \`${issue.number}\` to ${this.owner}/${this.repo}`)
		await this.github.createIssue(
			this.owner,
			this.repo,
			issue.title,
			(issue.body ?? '').replace(/@|#|issues/g, '-').replace(/\/github.com\//g, '/github-com/'),
		)
	}
}
