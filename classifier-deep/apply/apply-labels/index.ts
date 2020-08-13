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
	vacation?: string[]
	labels?: {
		[area: string]: { accuracy?: number; assign?: [string] }
	}
	assignees?: {
		[assignee: string]: { accuracy?: number }
	}
}

type Labeling = { confident: boolean; category: string; confidence: number }
type LabelingsFile = { number: number; area: Labeling; assignee: Labeling }[]

class ApplyLabels extends Action {
	id = 'Classifier-Deep/Apply/ApplyLabels'

	async onTriggered(github: OctoKit) {
		const config: ClassifierConfig = await github.readConfig(getRequiredInput('configPath'))
		const labelings: LabelingsFile = JSON.parse(
			readFileSync(join(__dirname, '../issue_labels.json'), { encoding: 'utf8' }),
		)
		console.log('labelings:', labelings)

		for (const labeling of labelings) {
			const issue = new OctoKitIssue(token, context.repo, { number: labeling.number })
			const addAssignee = async (assignee: string) => {
				if (config.vacation?.includes(assignee)) {
					console.log('not assigning ', assignee, 'becuase they are on vacation')
				} else {
					await issue.addAssignee(assignee)
				}
			}

			const issueData = await issue.getIssue()
			if (
				!debug &&
				(issueData.assignee || issueData.labels.some((label) => !allowLabels.includes(label)))
			) {
				console.log('skipping')
				continue
			}

			console.log('not skipping', {
				assignee: labeling.assignee,
				area: labeling.area,
				number: labeling.number,
			})

			{
				const { category, confidence, confident } = labeling.assignee
				if (debug) {
					if (confident) {
						if (!(await github.repoHasLabel(category))) {
							console.log(`creating assignee label`)
							await github.createLabel(category, 'ffa5a1', '')
						}
						await issue.addLabel(category)
					}
					await issue.postComment(
						`confidence for assignee ${category}: ${confidence}. ${
							confident ? 'does' : 'does not'
						} meet threshold`,
					)
				}

				if (confident) {
					console.log('has assignee')
					const assigneeConfig = config.assignees?.[category]
					console.log({ assigneeConfig })
					await addAssignee(category)
					await trackEvent(issue, 'classification:performed', {
						assignee: labeling.assignee.category,
					})
				}
			}

			{
				const { category, confidence, confident } = labeling.area
				if (debug) {
					if (confident) {
						if (!(await github.repoHasLabel(category))) {
							console.log(`creating label`)
							await github.createLabel(category, 'f1d9ff', '')
						}
						await issue.addLabel(category)
					}
					await issue.postComment(
						`confidence for label ${category}: ${confidence}. ${
							confident ? 'does' : 'does not'
						} meet threshold`,
					)
				}

				if (confident) {
					console.log(`adding label ${category} to issue ${issueData.number}`)

					const labelConfig = config.labels?.[category]
					await Promise.all<any>([
						...(labelConfig?.assign
							? labelConfig.assign.map((assignee) => addAssignee(assignee))
							: []),
					])

					await trackEvent(issue, 'classification:performed', {
						label: labeling.area.category,
					})
				}
			}
		}
	}
}

new ApplyLabels().run() // eslint-disable-line