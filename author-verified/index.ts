/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OctoKitIssue } from '../api/octokit'
import { getRequiredInput } from '../common/utils'
import { AuthorVerifiedLabeler } from './AuthorVerified'
import { Action } from '../common/Action'

const requestVerificationComment = getRequiredInput('requestVerificationComment')
const releasedLabel = getRequiredInput('releasedLabel')
const verifiedLabel = getRequiredInput('verifiedLabel')
const authorVerificationRequestedLabel = getRequiredInput('authorVerificationRequestedLabel')

class AuthorVerified extends Action {
	id = 'AuthorVerified'

	private runLabler(issue: OctoKitIssue) {
		return new AuthorVerifiedLabeler(
			issue,
			requestVerificationComment,
			releasedLabel,
			authorVerificationRequestedLabel,
			verifiedLabel,
		).run()
	}

	async onClosed(issue: OctoKitIssue) {
		await this.runLabler(issue)
	}

	async onLabeled(issue: OctoKitIssue, label: string) {
		if (label === authorVerificationRequestedLabel || label === releasedLabel) {
			await this.runLabler(issue)
		}
	}
}

new AuthorVerified().run() // eslint-disable-line
