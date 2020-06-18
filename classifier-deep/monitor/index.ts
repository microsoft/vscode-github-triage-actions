/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OctoKitIssue } from '../../api/octokit'
import { Action, trackEvent } from '../../common/Action'
import { getRequiredInput } from '../../common/utils'

class DeepClassifierMonitor extends Action {
	id = 'Classifier-Deep/Monitor'

	async onUnassigned(issue: OctoKitIssue, assignee: string) {
		const assigner = await issue.getAssigner(assignee)
		if (assigner === getRequiredInput('botName')) {
			await trackEvent('deep-classifier:unassigned', { assignee })
		}
	}
}

new DeepClassifierMonitor().run() // eslint-disable-line
