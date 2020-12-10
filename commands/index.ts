/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OctoKitIssue } from '../api/octokit'
import { getRequiredInput } from '../common/utils'
import { Commands } from './Commands'
import { Action } from '../common/Action'
import { context } from '@actions/github'
import { Issue } from '../api/api'

const hydrate = (comment: string, issue: Issue) => {
	const baseQueryString = `https://github.com/${context.repo.owner}/${context.repo.repo}/issues?utf8=%E2%9C%93&q=is%3Aopen+is%3Aissue+`
	const importantLabels = issue.labels.filter((label) => label !== '*duplicate')
	const labelsQueryString = encodeURIComponent(importantLabels.map((label) => `label:"${label}"`).join(' '))
	const url = baseQueryString + labelsQueryString
	return comment.replace('${duplicateQuery}', url)
}

class CommandsRunner extends Action {
	id = 'Commands'

	async onCommented(issue: OctoKitIssue, comment: string, actor: string) {
		const commands = await issue.readConfig(getRequiredInput('config-path'))
		await new Commands(issue, commands, { comment, user: { name: actor } }, hydrate).run()
	}

	async onLabeled(issue: OctoKitIssue, label: string) {
		const commands = await issue.readConfig(getRequiredInput('config-path'))
		await new Commands(issue, commands, { label }, hydrate).run()
	}
}

new CommandsRunner().run() // eslint-disable-line
