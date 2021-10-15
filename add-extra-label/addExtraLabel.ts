/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GitHubIssue } from '../api/api'
import { safeLog } from '../common/utils'

export class AddExtraLabel {
	constructor(private github: GitHubIssue, private newLabel: string) {}

	async run() {
		const issue = await this.github.getIssue()
		safeLog(`Adding extra label \`${this.newLabel}\` to issue \`${issue.number}\``)
		await this.github.addLabel(this.newLabel)
	}
}
