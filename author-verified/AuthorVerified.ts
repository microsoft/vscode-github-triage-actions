/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GitHub, GitHubIssue } from '../api/api'
import { loadLatestRelease, safeLog } from '../common/utils'
import { trackEvent } from '../common/telemetry'

export class AuthorVerifiedQueryer {
	constructor(
		private github: GitHub,
		private comment: string,
		private releasedLabel: string,
		private authorVerificationRequestedLabel: string,
		private verifiedLabel: string,
	) {}

	async run(): Promise<void> {
		const query = `is:closed label:${this.releasedLabel} label:${this.authorVerificationRequestedLabel}`
		for await (const page of this.github.query({ q: query })) {
			for (const issue of page) {
				const issueData = await issue.getIssue()
				if (
					issueData.labels.includes(this.releasedLabel) &&
					issueData.labels.includes(this.authorVerificationRequestedLabel) &&
					issueData.open === false
				) {
					await new AuthorVerifiedLabeler(
						issue,
						this.comment,
						this.releasedLabel,
						this.authorVerificationRequestedLabel,
						this.verifiedLabel,
					).run()
					await new Promise((resolve) => setTimeout(resolve, 1000))
				} else {
					safeLog('Query returned an invalid issue:' + issueData.number)
				}
			}
		}
	}
}

export class AuthorVerifiedLabeler {
	constructor(
		private github: GitHubIssue,
		private comment: string,
		private releasedLabel: string,
		private authorVerificationRequestedLabel: string,
		private verifiedLabel: string,
	) {}

	async run(): Promise<void> {
		const issue = await this.github.getIssue()

		if (issue.open) {
			return
		}

		if (
			issue.labels.includes(this.authorVerificationRequestedLabel) &&
			issue.labels.includes(this.releasedLabel)
		) {
			const latestRelease = await loadLatestRelease('insider')
			if (!latestRelease) throw Error('Error loading latest release')
			await trackEvent(this.github, 'author-verified:verifiable')
			if (!issue.labels.includes(this.verifiedLabel)) {
				await this.github.postComment(
					this.comment
						.replace('${commit}', latestRelease.version)
						.replace('${author}', issue.author.name),
				)
			}
		}
	}
}
