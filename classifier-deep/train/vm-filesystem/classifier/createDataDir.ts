/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs'
import * as path from 'path'

//#region types&utils
type LabelEvent = AddedLabelEvent | RemovedLabelEvent

type AddedLabelEvent = {
	type: 'added'
	label: string
	actor: string
	title: string
	body: string
}

type RemovedLabelEvent = {
	type: 'removed'
	label: string
}

type JSONOutputLine = {
	number: number
	title: string
	body: string
	createdAt: number
	labels: string[]
	assignees: string[]
	labelEvents: LabelEvent[]
	closedWithCode: boolean
}

interface Classification {
	name: string
	categoryPriority: string[]
	categoriesExtractor: (issue: JSONOutputLine) => string[]
}

const normalizeIssue = (issue: {
	body: string
	title: string
}): { body: string; title: string; issueType: 'bug' | 'feature_request' | 'unknown' } => {
	const { body, title } = issue

	const isBug = body.includes('bug_report_template') || /Issue Type:.*Bug.*/.test(body)
	const isFeatureRequest =
		body.includes('feature_request_template') || /Issue Type:.*Feature Request.*/.test(body)

	const cleanse = (str: string) => {
		let out = str
			.toLowerCase()
			.replace(/<!--.*-->/gu, '')
			.replace(/.* version: .*/gu, '')
			.replace(/issue type: .*/gu, '')
			.replace(/vs ?code/gu, '')
			.replace(/we have written.*please paste./gu, '')
			.replace(/steps to reproduce:/gu, '')
			.replace(/does this issue occur when all extensions are disabled.*/gu, '')
			.replace(/!?\[[^\]]*\]\([^)]*\)/gu, '')
			.replace(/\s+/gu, ' ')
			.replace(/```[^`]*?```/gu, '')

		while (
			out.includes(`<details>`) &&
			out.includes('</details>') &&
			out.indexOf(`</details>`) > out.indexOf(`<details>`)
		) {
			out = out.slice(0, out.indexOf('<details>')) + out.slice(out.indexOf(`</details>`) + 10)
		}

		return out
	}

	return {
		body: cleanse(body),
		title: cleanse(title),
		issueType: isBug ? 'bug' : isFeatureRequest ? 'feature_request' : 'unknown',
	}
}
//#endregion

const DATA_DIR = 'train_data'

const createDataDirectories = async (areas: string[], assignees: string[]) => {
	const classifications: Classification[] = [
		{
			name: 'area',
			categoryPriority: areas,
			categoriesExtractor: (issue) => issue.labels,
		},
		{
			name: 'assignee',
			categoryPriority: assignees,
			categoriesExtractor: (issue) => issue.assignees,
		},
	]

	const dumpFile = path.join(__dirname, 'issues.json')
	const issues: JSONOutputLine[] = fs
		.readFileSync(dumpFile, { encoding: 'utf8' })
		.split('\n')
		.filter((l) => l)
		.map((l) => JSON.parse(l))

	for (const classification of classifications) {
		const { name, categoryPriority, categoriesExtractor } = classification

		console.log('creating', name, 'data dirs')

		const categoryPriorityFn = (categories: string[]) =>
			categoryPriority.find((candidate) => categories.indexOf(candidate) !== -1)

		const seen: Record<string, number> = {}

		const ignoredLabels = Object.entries(
			issues
				.map((issue) => categoryPriorityFn(issue.labels))
				.filter((x): x is string => !!x)
				.reduce((record: Record<string, number>, label) => {
					record[label] = (record[label] ?? 0) + 1
					return record
				}, {}),
		)
			.filter(([_, count]) => count < 5)
			.map(([label]) => label)

		for (const issue of issues) {
			const category = categoryPriorityFn(categoriesExtractor(issue))
			const isDuplicate = issue.labels.includes('*duplicate')
			const isHumanLabeled = !!issue.labelEvents.find(
				(event) =>
					event.type === 'added' &&
					event.label === category &&
					![
						'vscodebot',
						'github-actions',
						'vscode-triage-bot',
						'VSCodeTriageBot',
						'vs-code-engineering[bot]',
						'vs-code-engineering',
					].includes(event.actor),
			)

			if (
				category &&
				!ignoredLabels.includes(category) &&
				(name !== 'area' || (!isDuplicate && isHumanLabeled))
			) {
				if (!seen[category]) {
					seen[category] = 0
					fs.mkdirSync(path.join(__dirname, DATA_DIR, name, category), {
						recursive: true,
					})

					await new Promise((resolve) => setTimeout(resolve, 100)) // ?
				}

				const filepath = path.join(__dirname, DATA_DIR, name, category)

				const { title, body } = normalizeIssue(issue)
				const filename = `${issue.number}.txt`
				const content = `${title}\n\n${body}`
				fs.writeFileSync(path.join(filepath, filename), content)

				seen[category]++
			}
		}
		console.log('Ignored', ignoredLabels)
	}
}

// eslint-disable-next-line
createDataDirectories(
	[
		// Lables to classify
	],
	[
		// Persons to assign
	],
)
