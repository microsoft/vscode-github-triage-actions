/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import { normalizeIssue, safeLog } from '../../../common/utils';
import { JSONOutputLine } from './download';

interface Classification {
	name: string;
	categoryPriority: string[] | ((candidates: string[]) => string | undefined);
	labelToCategory: Record<string, string> | ((label: string) => string);
	categoriesExtractor: (issue: JSONOutputLine) => string[];
}

const DATA_DIR = 'train_data';

export const createDataDirectories = async (areas: string[], assignees: string[]) => {
	const classifications: Classification[] = [
		{
			name: 'area',
			categoryPriority: areas,
			labelToCategory: {},
			categoriesExtractor: (issue) => issue.labels,
		},
		{
			name: 'assignee',
			labelToCategory: {},
			categoriesExtractor: (issue) => issue.assignees,
			categoryPriority: assignees,
		},
	];

	const dumpFile = path.join(__dirname, 'issues.json');
	const issues: JSONOutputLine[] = fs
		.readFileSync(dumpFile, { encoding: 'utf8' })
		.split('\n')
		.filter((l) => l)
		.map((l) => JSON.parse(l));

	for (const classification of classifications) {
		const { name, categoryPriority, labelToCategory, categoriesExtractor } = classification;
		const labelToCategoryFn =
			typeof labelToCategory === 'function'
				? labelToCategory
				: (label: string) => labelToCategory[label];
		const categoryPriorityFn =
			typeof categoryPriority === 'function'
				? categoryPriority
				: (categories: string[]) =>
						categoryPriority.find((candidate) => categories.indexOf(candidate) !== -1);

		const seen: Record<string, number> = {};

		const ignoredLabels = Object.entries(
			issues
				.map((issue) => issue.labels.map((label) => labelToCategoryFn(label) || label))
				.map((labels) => categoryPriorityFn(labels))
				.filter((x): x is string => !!x)
				.reduce((record: Record<string, number>, label) => {
					record[label] = (record[label] ?? 0) + 1;
					return record;
				}, {}),
		)
			.filter(([_, count]) => count < 5)
			.map(([label]) => label);

		for (const issue of issues) {
			const category =
				categoryPriorityFn(
					categoriesExtractor(issue).map((label) => labelToCategoryFn(label) || label),
				) ??
				(['*caused-by-extension', 'info-needed', '*question'].find((otherLabel) =>
					issue.labels.includes(otherLabel),
				)
					? name === 'area' && Math.random() < 0.2
						? '__OTHER__'
						: undefined
					: undefined);

			const isDuplicate = issue.labels.includes('*duplicate');

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
			);

			if (
				category &&
				!ignoredLabels.includes(category) &&
				(name === 'assignee' || (!isDuplicate && (isHumanLabeled || category === '__OTHER__')))
			) {
				if (!seen[category]) {
					seen[category] = 0;
					fs.mkdirSync(path.join(__dirname, '..', DATA_DIR, name, 'train', category), {
						recursive: true,
					});
					fs.mkdirSync(path.join(__dirname, '..', DATA_DIR, name, 'test', category), {
						recursive: true,
					});

					await new Promise((resolve) => setTimeout(resolve, 100)); // ?
				}

				const filepath = path.join(
					__dirname,
					'..',
					DATA_DIR,
					name,
					Math.random() < 0.8 || seen[category] == 0 ? 'train' : 'test',
					category,
				);

				const { title, body } = normalizeIssue(issue);
				const filename = `${issue.number}.txt`;
				const content = `${title}\n\n${body}`;
				fs.writeFileSync(path.join(filepath, filename), content);

				seen[category]++;
			}
		}
		safeLog('Ignored', ignoredLabels);
	}
};
