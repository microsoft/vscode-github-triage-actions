/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GitHubIssue, Issue, User } from '../api/api';
import { safeLog } from '../common/utils';

/* eslint-disable */
// confusing when eslint formats
export type Command =
	& { name: string }
	& ({ type: 'comment'; allowUsers?: string[] } | { type: 'label', regex?: string })
	& { action?: 'close', reason?: 'not_planned' | 'completed' }
	& Partial<{ comment: string; addLabel: string; removeLabel: string, assign: string[] }>
	& Partial<{ requireLabel: string; disallowLabel: string }>
/* eslint-enable */

export class Commands {
	constructor(
		private github: GitHubIssue,
		private config: Command[],
		private action: { label: string } | { comment: string; user: User },
		private hydrate: (comment: string, issue: Issue) => string,
	) {}

	private async matches(command: Command, issue: Issue): Promise<boolean> {
		if (command.requireLabel && !issue.labels.includes(command.requireLabel)) {
			return false;
		}
		if (command.disallowLabel && issue.labels.includes(command.disallowLabel)) {
			return false;
		}

		if ('label' in this.action) {
			if (!(command.type === 'label')) return false;
			const regexMatch = command.regex && new RegExp(command.regex).test(this.action.label);
			const nameMatch = this.action.label === command.name;
			return !!(nameMatch || regexMatch);
		} else {
			return !!(
				command.type === 'comment' &&
				!!this.action.comment.match(
					new RegExp(`(/|\\\\)${escapeRegExp(command.name)}(\\s|$)`, 'i'),
				) &&
				((await this.github.hasWriteAccess(this.action.user.name)) ||
					command.allowUsers?.includes(this.action.user.name) ||
					command.allowUsers?.includes('*') ||
					(this.action.user.name === issue.author.name && command.allowUsers?.includes('@author')))
			);
		}
	}

	private async perform(command: Command, issue: Issue) {
		if (!(await this.matches(command, issue))) return;
		safeLog(`Running command ${command.name}:`);

		const tasks = [];

		if ('comment' in this.action && (command.name === 'label' || command.name === 'assign')) {
			const args: { task: 'add' | 'remove'; name: string }[] = [];
			let argList = (
				this.action.comment.match(
					new RegExp(String.raw`(?:^|\s)(?:\\|/)${command.name}(.*)(?:\r)?(?:\n|$)`),
				)?.[1] ?? ''
			).trim();
			while (argList) {
				const task = argList[0] === '-' ? 'remove' : 'add';
				if (task === 'remove') argList = argList.slice(1);

				if (argList[0] === '"') {
					const endIndex = argList.indexOf('"', 1);
					if (endIndex === -1)
						throw Error('Unable to parse arglist. Could not find matching double quote');
					args.push({ task, name: argList.slice(1, endIndex) });
					argList = argList.slice(endIndex + 1).trim();
				} else {
					const endIndex = argList.indexOf(' ', 1);
					if (endIndex === -1) {
						args.push({ task, name: argList });
						argList = '';
					} else {
						args.push({ task, name: argList.slice(0, endIndex) });
						argList = argList.slice(endIndex + 1).trim();
					}
				}
			}

			if (command.name === 'label') {
				tasks.push(
					...args.map((arg) =>
						arg.task === 'add'
							? this.github.addLabel(arg.name)
							: this.github.removeLabel(arg.name),
					),
				);
			}

			if (command.name === 'assign') {
				tasks.push(
					...args.map((arg) =>
						arg.task === 'add'
							? this.github.addAssignee(arg.name[0] === '@' ? arg.name.slice(1) : arg.name)
							: this.github.removeAssignee(arg.name[0] === '@' ? arg.name.slice(1) : arg.name),
					),
				);
			}
		}

		if (command.action === 'close') {
			tasks.push(this.github.closeIssue(command.reason ?? 'completed'));
		}

		if (command.comment && (command.action !== 'close' || issue.open)) {
			tasks.push(this.github.postComment(this.hydrate(command.comment, issue)));
		}

		if (command.addLabel) {
			tasks.push(this.github.addLabel(command.addLabel));
		}

		if (command.assign) {
			tasks.push(...command.assign.map((assignee) => this.github.addAssignee(assignee)));
		}

		if (command.removeLabel) {
			tasks.push(this.github.removeLabel(command.removeLabel));
		}

		await Promise.all(tasks);
	}

	async run() {
		const issue = await this.github.getIssue();
		if (!issue) return;
		return Promise.all(this.config.map((command) => this.perform(command, issue)));
	}
}

// From user CoolAJ86 on https://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
function escapeRegExp(string: string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
