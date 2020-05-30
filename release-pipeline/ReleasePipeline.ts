/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GitHub, GitHubIssue } from '../api/api'
import { loadLatestRelease } from '../utils/utils'

export class ReleasePipelineQueryer {
	constructor(
		private github: GitHub,
		private notYetReleasedLabel: string,
		private insidersReleasedLabel: string,
	) {}

	async run() {
		const query = `is:closed label:${this.notYetReleasedLabel}`
		for await (const page of this.github.query({ q: query })) {
			for (const issue of page) {
				const issueData = await issue.getIssue()
				if (issueData.labels.includes(this.notYetReleasedLabel) && issueData.open === false) {
					await new ReleasePipelineLabeler(
						issue,
						this.notYetReleasedLabel,
						this.insidersReleasedLabel,
					).run()
					await new Promise((resolve) => setTimeout(resolve, 1000))
				} else {
					console.log(
						'Query returned an invalid issue:' +
							JSON.stringify({ ...issueData, body: 'stripped' }),
					)
				}
			}
		}
	}
}

export class ReleasePipelineLabeler {
	constructor(
		private github: GitHubIssue,
		private notYetReleasedLabel: string,
		private insidersReleasedLabel: string,
	) {}

	async run() {
		const latestRelease = await loadLatestRelease('insider')
		if (!latestRelease) throw Error('Error loading latest release')

		const closingHash = (await this.github.getClosingInfo())?.hash
		if (!closingHash) {
			return this.github.postComment(
				`<!-- UNABLE_TO_LOCATE_COMMIT_MESSAGE -->
Issue marked as unreleased but unable to locate closing commit. You can manually reference a commit by commenting \`\\closedWith someCommitSha\`.`,
			)
		}

		let releaseContainsCommit = await this.github.releaseContainsCommit(
			latestRelease.version,
			closingHash,
		)

		if (releaseContainsCommit === 'yes') {
			await this.github.removeLabel(this.notYetReleasedLabel)
			await this.github.addLabel(this.insidersReleasedLabel)
		} else if (releaseContainsCommit === 'no') {
			await this.github.addLabel(this.notYetReleasedLabel)
		} else if ((await this.github.getIssue()).labels.includes(this.notYetReleasedLabel)) {
			await this.github.postComment(
				`<!-- UNABLE_TO_LOCATE_COMMIT_MESSAGE -->
Issue marked as unreleased but unable to locate closing commit. You can manually reference a commit by commenting \`\\closedWith someCommitSha\`.`,
			)
		}
	}
}
