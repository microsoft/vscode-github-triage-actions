/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as core from '@actions/core'
import { readFileSync } from 'fs'
import { join } from 'path'
import { context } from '@actions/github'
import { OctoKit, OctoKitIssue } from '../../../api/octokit'
import { getRequiredInput, logErrorToIssue, logRateLimit, getInput } from '../../../utils/utils'

const token = getRequiredInput('token')
const allowLabels = (getInput('allowLabels') || '').split('|')
const debug = !!getInput('__debug')

console.log({ debug })

type ClassifierConfig = {
	labels: {
		[area: string]: { assignLabel?: boolean; comment?: string; assign?: [string] }
	}
	assignees: {
		[assignee: string]: { assign: boolean; comment?: string }
	}
}

const main = async () => {
	console.log('hello')

	const github = new OctoKit(token, context.repo)
	const config: ClassifierConfig = await github.readConfig(getRequiredInput('config-path'))
	const labelings: { number: number; labels: string[]; assignee: string }[] = JSON.parse(
		readFileSync(join(__dirname, '../issue_labels.json'), { encoding: 'utf8' }),
	)
	console.log('labelings:', labelings)

	for (const labeling of labelings) {
		const issue = new OctoKitIssue(token, context.repo, { number: labeling.number })
		const issueData = await issue.getIssue()
		if (
			!debug &&
			(issueData.assignee ||
				issueData.numComments ||
				issueData.labels.some((label) => !allowLabels.includes(label)))
		) {
			console.log('skipping')
			continue
		}
		console.log('not skipping', {
			assignee: labeling.assignee,
			labels: labeling.labels,
			number: labeling.number,
		})

		const assignee = labeling.assignee
		if (assignee) {
			if (debug && !(await github.repoHasLabel(assignee))) {
				console.log(`creating assignee label`)
				await github.createLabel(assignee, 'ffa5a1', '')
			}

			const assigneeConfig = config.assignees?.[assignee]
			await Promise.all<any>([
				assigneeConfig?.assign || debug ? issue.addAssignee(assignee) : Promise.resolve(),
				assigneeConfig?.comment ? issue.postComment(assigneeConfig.comment) : Promise.resolve(),
			])
		}

		const label = labeling.labels.length === 1 ? labeling.labels[0] : undefined
		if (label) {
			console.log(`adding label ${label} to issue ${issueData.number}`)

			if (debug) {
				console.log(`create labels enabled`)
				if (!(await github.repoHasLabel(label))) {
					console.log(`creating label`)
					await github.createLabel(label, 'f1d9ff', '')
				}
			}
			const labelConfig = config.labels?.[label]
			await Promise.all<any>([
				labelConfig?.assignLabel || debug ? issue.addLabel(label) : Promise.resolve,
				labelConfig?.comment ? issue.postComment(labelConfig.comment) : Promise.resolve(),
				...(labelConfig?.assign
					? labelConfig.assign.map((assignee) => issue.addAssignee(assignee))
					: []),
			])
		}
	}
}

main()
	.then(() => logRateLimit(token))
	.catch(async (error) => {
		core.setFailed(error.message)
		await logErrorToIssue(error, true, token)
	})
