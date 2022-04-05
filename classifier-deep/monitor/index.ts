/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OctoKitIssue } from '../../api/octokit'
import { Action } from '../../common/Action'
import { getRequiredInput, safeLog } from '../../common/utils'
import { trackEvent } from '../../common/telemetry'

class DeepClassifierMonitor extends Action {
	id = 'Classifier-Deep/Monitor'

	protected async onAssigned(issue: OctoKitIssue, assignee: string): Promise<void> {
		const assigner = await issue.getAssigner(assignee)
		if (assigner !== getRequiredInput('botName')) {
			await issue.removeLabel('triage-needed')
		}
	}

	async onUnassigned(issue: OctoKitIssue, assignee: string) {
		try {
			const assigner = await issue.getAssigner(assignee)
			if (assigner === getRequiredInput('botName')) {
				await trackEvent(issue, 'deep-classifier:unassigned', { assignee })
			}
		} catch {
			// issue deleted or something, just ignore
			safeLog('error reading unassign data')
		}
	}
}

new DeepClassifierMonitor().run() // eslint-disable-line
