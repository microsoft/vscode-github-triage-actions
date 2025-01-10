/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { readFileSync } from 'fs';
import { join } from 'path';
import { OctoKit, OctoKitIssue } from '../../../api/octokit';
import { Action, getAuthenticationToken } from '../../../common/Action';
import { getInput, getRequiredInput, safeLog } from '../../../common/utils';

const debug = !!getInput('__debug');
const owner = getRequiredInput('owner');
const repo = getRequiredInput('repo');

type ClassifierConfig = {
	labels?: {
		[area: string]: { applyLabel?: boolean; comment?: string; assign?: [string] };
	};
	randomAssignment?: boolean;
	assignees?: {
		[assignee: string]: { assign: boolean; comment?: string };
	};
};

class ApplyLabels extends Action {
	id = 'Classifier/Apply/ApplyLabels';

	async onTriggered(github: OctoKit) {
		const token = await getAuthenticationToken();
		const config: ClassifierConfig = await github.readConfig(getRequiredInput('config-path'));
		const labelings: { number: number; area: string; assignee: string }[] = JSON.parse(
			readFileSync(join(__dirname, '../issue_labels.json'), { encoding: 'utf8' }),
		);

		for (const labeling of labelings) {
			const issue = new OctoKitIssue(token, { owner, repo }, { number: labeling.number });
			const issueData = await issue.getIssue();
			if (!issueData) continue;

			if (!debug && issueData.assignee) {
				safeLog('skipping, already assigned to: ', issueData.assignee);
				continue;
			}

			const assignee = labeling.assignee;
			if (assignee) {
				safeLog('has assignee:', assignee);

				if (debug) {
					if (!(await github.repoHasLabel(assignee))) {
						safeLog(`creating assignee label`);
						await github.createLabel(assignee, 'ffa5a1', '');
					}
					await issue.addLabel(assignee);
				}

				const assigneeConfig = config.assignees?.[assignee];
				if (assigneeConfig) {
					safeLog(JSON.stringify({ assigneeConfig }));

					await Promise.all<any>([
						assigneeConfig?.assign ? !debug && issue.addAssignee(assignee) : Promise.resolve(),
						assigneeConfig?.comment
							? issue.postComment(assigneeConfig.comment)
							: Promise.resolve(),
					]);
				} else if (!debug) {
					await issue.addAssignee(assignee);
				}
			} else if (config.randomAssignment && config.labels) {
				safeLog('could not find assignee, picking a random one...');
				const available = Object.keys(config.labels).reduce((acc, area) => {
					const areaConfig = config.labels?.[area];
					if (areaConfig?.assign) {
						acc.push(...areaConfig.assign);
					}
					return acc;
				}, [] as string[]);
				if (available) {
					// Shuffle the array
					for (let i = available.length - 1; i > 0; i--) {
						const j = Math.floor(Math.random() * (i + 1));
						[available[i], available[j]] = [available[j], available[i]];
					}
					if (!debug) {
						const issue = new OctoKitIssue(token, { owner, repo }, { number: labeling.number });

						await issue.addLabel('triage-needed');
						const randomSelection = available[0];
						safeLog('assigning', randomSelection);
						await issue.addAssignee(randomSelection);
					}
				} else {
					safeLog('error assigning random: no assigness found');
				}
			}

			const label = labeling.area;
			if (label) {
				safeLog(`adding label ${label} to issue ${issueData.number}`);

				if (debug) {
					if (!(await github.repoHasLabel(label))) {
						safeLog(`creating label`);
						await github.createLabel(label, 'f1d9ff', '');
					}
				}

				const labelConfig = config.labels?.[label];
				await Promise.all<any>([
					labelConfig?.applyLabel || debug ? issue.addLabel(label) : Promise.resolve,
					labelConfig?.comment ? issue.postComment(labelConfig.comment) : Promise.resolve(),
					...(labelConfig?.assign
						? labelConfig.assign.map((assignee) => issue.addAssignee(assignee))
						: []),
				]);
			}
		}
	}
}

new ApplyLabels().run() // eslint-disable-line