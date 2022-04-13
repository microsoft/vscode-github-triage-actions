/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Comment, GitHubIssue, Issue } from '../api/api'
import { safeLog } from '../common/utils'
import { parseTestPlanItem } from './validator'

const commentTag = '<!-- INVALID TEST PLAN ITEM -->'

export class TestPlanItemValidator {
	constructor(
		private github: GitHubIssue,
		private label: string,
		private invalidLabel: string,
		private comment: string,
	) {}

	async run() {
		const issue = await this.github.getIssue()
		if (!(issue.labels.includes(this.label) || issue.labels.includes(this.invalidLabel))) {
			safeLog(
				`Labels ${this.label}/${this.invalidLabel} not in issue labels ${issue.labels.join(
					',',
				)}. Aborting.`,
			)
			return
		}

		const tasks: Promise<void>[] = []

		let priorComments: Comment[] | undefined = undefined
		for await (const page of this.github.getComments()) {
			priorComments = page.filter((comment) => comment.body.indexOf(commentTag) !== -1)
			if (priorComments) {
				safeLog('Found prior comment. Deleting.')
				tasks.push(...priorComments.map((comment) => this.github.deleteComment(comment.id)))
			}
			break
		}

		const errors = this.getErrors(issue)
		if (errors) {
			tasks.push(this.github.postComment(`${commentTag}\n${this.comment}\n\n**Error:** ${errors}`))
			tasks.push(this.github.addLabel(this.invalidLabel))
			tasks.push(this.github.removeLabel(this.label))
		} else {
			safeLog('All good!')
			tasks.push(this.github.removeLabel(this.invalidLabel))
			tasks.push(this.github.addLabel(this.label))
		}

		await Promise.all(tasks)
	}

	private getErrors(issue: Issue): string | undefined {
		try {
			parseTestPlanItem(issue.body, issue.author.name)
			return
		} catch (error) {
			const err = error as Error
			return err.message
		}
	}
}
