/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GitHub, GitHubIssue } from '../api/api'
import { loadLatestRelease } from '../utils/utils'

export class AuthorVerifiedQueryer {
	constructor(
		private github: GitHub,
		private comment: string,
		private pendingReleaseLabel: string,
		private authorVerificationRequestedLabel: string,
	) {}

	async run(): Promise<void> {
		const latestRelease = (await loadLatestRelease('insider'))?.version
		if (!latestRelease) throw Error('Error loading latest release')

		const query = `is:closed label:${this.pendingReleaseLabel} label:${this.authorVerificationRequestedLabel}`
		for await (const page of this.github.query({ q: query })) {
			for (const issue of page) {
				const issueData = await issue.getIssue()
				if (
					issueData.labels.includes(this.pendingReleaseLabel) &&
					issueData.labels.includes(this.authorVerificationRequestedLabel) &&
					issueData.open === false
				) {
					await new AuthorVerifiedLabeler(
						issue,
						this.comment,
						this.pendingReleaseLabel,
						this.authorVerificationRequestedLabel,
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

export class AuthorVerifiedLabeler {
	constructor(
		private github: GitHubIssue,
		private comment: string,
		private pendingReleaseLabel: string,
		private authorVerificationRequestedLabel: string,
	) {}

	async run(): Promise<void> {
		const issue = await this.github.getIssue()

		if (issue.open) {
			return
		}

		if (issue.labels.find((label) => label === this.authorVerificationRequestedLabel)) {
			const latestRelease = await loadLatestRelease('insider')
			if (!latestRelease) throw Error('Error loading latest release')

			const closingInfo = await this.github.getClosingInfo()
			if (!closingInfo) throw Error('Error loading closing info')

			let releaseContainsCommit = false
			if (closingInfo.hash) {
				try {
					releaseContainsCommit = await this.github.releaseContainsCommit(
						latestRelease.version,
						closingInfo.hash,
					)
				} catch (e) {
					const message: string = e.message
					if (message.includes(`Not a valid commit name ${closingInfo.hash}`)) {
						// Closing commit in seprate repo. Fall back to close date.
						releaseContainsCommit = closingInfo.timestamp < latestRelease.timestamp
					} else if (message.includes(`Not a valid commit name ${latestRelease.version}`)) {
						// Release commit in seprate branch. Likely endgame. Commit is not released.
						releaseContainsCommit = false
					} else {
						throw e
					}
				}
			} else {
				releaseContainsCommit = closingInfo.timestamp < latestRelease.timestamp
			}

			if (releaseContainsCommit) {
				console.log('determined released due to closing info recieved:', JSON.stringify(closingInfo))
				await this.github.removeLabel(this.pendingReleaseLabel)
				await this.github.postComment(
					this.comment
						.replace('${commit}', latestRelease.version)
						.replace('${author}', issue.author.name),
				)
			} else {
				await this.github.addLabel(this.pendingReleaseLabel)
			}
		}
	}
}
