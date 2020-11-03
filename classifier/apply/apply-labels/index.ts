/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { readFileSync } from 'fs'
import { join } from 'path'
import { context } from '@actions/github'
import { OctoKit, OctoKitIssue } from '../../../api/octokit'
import { getRequiredInput, getInput } from '../../../common/utils'
import { Action } from '../../../common/Action'
import { trackEvent } from '../../../common/telemetry'

const token = getRequiredInput('token')
const allowLabels = (getInput('allowLabels') || '').split('|')
const debug = !!getInput('__debug')

type ClassifierConfig = {
	labels?: {
		[area: string]: { applyLabel?: boolean; comment?: string; assign?: [string] }
	}
	assignees?: {
		[assignee: string]: { assign: boolean; comment?: string }
	}
}

class ApplyLabels extends Action {
	id = 'Classifier/Apply/ApplyLabels'

	async onTriggered(github: OctoKit) {
		const config: ClassifierConfig = await github.readConfig(getRequiredInput('config-path'))
		const labelings: { number: number; area: string; assignee: string }[] = JSON.parse(
			readFileSync(join(__dirname, '../issue_labels.json'), { encoding: 'utf8' }),
		)

		for (const labeling of labelings) {
			const issue = new OctoKitIssue(token, context.repo, { number: labeling.number })
			const issueData = await issue.getIssue()
			if (
				!debug &&
				(issueData.assignee || issueData.labels.some((label) => !allowLabels.includes(label)))
			) {
				console.log('skipping')
				continue
			}

			const assignee = labeling.assignee
			if (assignee) {
				console.log('has assignee')

				if (debug) {
					if (!(await github.repoHasLabel(assignee))) {
						console.log(`creating assignee label`)
						await github.createLabel(assignee, 'ffa5a1', '')
					}
					await issue.addLabel(assignee)
				}

				const assigneeConfig = config.assignees?.[assignee]
				console.log({ assigneeConfig })

				await Promise.all<any>([
					assigneeConfig?.assign ? issue.addAssignee(assignee) : Promise.resolve(),
					assigneeConfig?.comment ? issue.postComment(assigneeConfig.comment) : Promise.resolve(),
				])
			}

			const label = labeling.area
			if (label) {
				console.log(`adding label ${label} to issue ${issueData.number}`)

				if (debug) {
					if (!(await github.repoHasLabel(label))) {
						console.log(`creating label`)
						await github.createLabel(label, 'f1d9ff', '')
					}
				}

				const labelConfig = config.labels?.[label]
				await Promise.all<any>([
					labelConfig?.applyLabel || debug ? issue.addLabel(label) : Promise.resolve,
					labelConfig?.comment ? issue.postComment(labelConfig.comment) : Promise.resolve(),
					...(labelConfig?.assign
						? labelConfig.assign.map((assignee) => issue.addAssignee(assignee))
						: []),
				])
			}

			await trackEvent(issue, 'classification:performed', { assignee, label })
		}
	}
}

new ApplyLabels().run() // eslint-disable-line