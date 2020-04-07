/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GitHubIssue, Issue, User } from '../api/api'

export type Command = { name: string } & ({ type: 'comment'; allowUsers: string[] } | { type: 'label' }) & {
		action?: 'close'
	} & Partial<{ comment: string; addLabel: string; removeLabel: string }> &
	Partial<{ requireLabel: string; disallowLabel: string }>

export class Commands {
	constructor(
		private github: GitHubIssue,
		private config: Command[],
		private action: { label: string } | { comment: string; user: User },
	) {}

	private async matches(command: Command, issue: Issue): Promise<boolean> {
		if (command.requireLabel && !issue.labels.includes(command.requireLabel)) {
			return false
		}
		if (command.disallowLabel && issue.labels.includes(command.disallowLabel)) {
			return false
		}

		if ('label' in this.action) {
			return command.type === 'label' && this.action.label === command.name
		} else {
			return (
				command.type === 'comment' &&
				!!this.action.comment.match(new RegExp(`(/|\\\\)${escapeRegExp(command.name)}(\\s|$)`)) &&
				((await this.github.hasWriteAccess(this.action.user)) ||
					command.allowUsers.includes(this.action.user.name) ||
					(this.action.user.name === issue.author.name && command.allowUsers.includes('@author')))
			)
		}
	}

	private async perform(command: Command, issue: Issue) {
		if (!(await this.matches(command, issue))) return
		console.log(`Running command ${command.name}:`)

		const tasks = []

		if (command.action === 'close') {
			tasks.push(this.github.closeIssue())
		}

		if (command.comment && (command.action !== 'close' || issue.open)) {
			tasks.push(this.github.postComment(command.comment))
		}

		if (command.addLabel) {
			tasks.push(this.github.addLabel(command.addLabel))
		}

		if (command.removeLabel) {
			tasks.push(this.github.removeLabel(command.removeLabel))
		}

		await Promise.all(tasks)
	}

	async run() {
		const issue = await this.github.getIssue()
		return Promise.all(this.config.map((command) => this.perform(command, issue)))
	}
}

// From user CoolAJ86 on https://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
function escapeRegExp(string: string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // $& means the whole matched string
}
