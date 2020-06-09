/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GitHubIssue } from '../api/api'
import { loadLatestRelease } from '../common/utils'

export class NewRelease {
	constructor(
		private github: GitHubIssue,
		private label: string,
		private labelColor: string,
		private labelDescription: string,
		private days: number,
	) {}

	async run() {
		const release = await loadLatestRelease('stable')
		if (!(release && release.timestamp)) throw Error('Could not load latest release')
		const daysSinceRelease = (Date.now() - release.timestamp) / (24 * 60 * 60 * 1000)

		if (daysSinceRelease > this.days) {
			// delete the label from the repo as a whole to remove it from all issues
			console.log('New release window passed. Globally deleting label ' + this.label)
			return this.github.deleteLabel(this.label)
		}

		const issue = await this.github.getIssue()
		const cleansed = issue.body.replace(/<!-- .* -->/g, '')

		if (
			!/VS ?Code Version:.*Insider/i.test(cleansed) &&
			new RegExp(
				`VS ?Code Version:(.*[^\\d])?${release.productVersion.replace('.', '\\.')}([^\\d]|$)`,
				'i',
			).test(cleansed)
		) {
			if (!(await this.github.repoHasLabel(this.label))) {
				console.log('First release issue found. Globally creating label ' + this.label)
				await this.github.createLabel(this.label, this.labelColor, this.labelDescription)
			}

			console.log('New release issue found. Adding label ' + this.label)
			await this.github.addLabel(this.label)
		}
	}
}
