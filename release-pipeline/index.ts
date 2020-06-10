/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OctoKit, OctoKitIssue } from '../api/octokit'
import { getRequiredInput } from '../common/utils'
import { ReleasePipeline, enrollIssue, unenrollIssue } from './ReleasePipeline'
import { Action } from '../common/Action'

const notYetReleasedLabel = getRequiredInput('notYetReleasedLabel')
const insidersReleasedLabel = getRequiredInput('insidersReleasedLabel')

class ReleasePipelineAction extends Action {
	id = 'ReleasePipeline'

	async onReopened(issue: OctoKitIssue) {
		await unenrollIssue(issue, notYetReleasedLabel, insidersReleasedLabel)
	}

	async onClosed(issue: OctoKitIssue) {
		await enrollIssue(issue, notYetReleasedLabel)
	}

	async onTriggered(github: OctoKit) {
		await new ReleasePipeline(github, notYetReleasedLabel, insidersReleasedLabel).run()
	}
}

new ReleasePipelineAction().run() // eslint-disable-line
