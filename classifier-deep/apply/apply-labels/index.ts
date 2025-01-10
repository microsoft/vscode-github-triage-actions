/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { readFileSync } from 'fs';
import { join } from 'path';
import { OctoKit, OctoKitIssue } from '../../../api/octokit';
import { VSCodeToolsAPIManager } from '../../../api/vscodeTools';
import { Action, getAuthenticationToken } from '../../../common/Action';
import { daysAgoToHumanReadbleDate, getInput, getRequiredInput, safeLog } from '../../../common/utils';

const allowLabels = (getInput('allowLabels') || '').split('|');
const debug = !!getInput('__debug');
const repo = getRequiredInput('repo');
const owner = getRequiredInput('owner');

type ClassifierConfig = {
	vacation?: string[];
	labels?: {
		[area: string]: { accuracy?: number; assign?: [string] };
	};
	assignees?: {
		[assignee: string]: { accuracy?: number };
	};
};

type Labeling = { confident: boolean; category: string; confidence: number };
type LabelingsFile = { number: number; area: Labeling; assignee: Labeling }[];

// Do not modify.
// Copied from https://github.com/microsoft/vscode-tools/blob/91715fe00caab042b4aab5ed41d0402b0ae2393b/src/common/endgame.ts#L11-L16
export enum Availability {
	FULL = 1,
	HALF,
	OPTIONAL,
	NOT_AVAILABLE,
}

class ApplyLabels extends Action {
	id = 'Classifier-Deep/Apply/ApplyLabels';

	async onTriggered(github: OctoKit) {
		const config: ClassifierConfig = await github.readConfig(getRequiredInput('configPath'));
		const token = await getAuthenticationToken();
		const labelings: LabelingsFile = JSON.parse(
			readFileSync(join(__dirname, '../issue_labels.json'), { encoding: 'utf8' }),
		);

		for (const labeling of labelings) {
			const issue = new OctoKitIssue(token, { owner, repo }, { number: labeling.number });

			const potentialAssignees: string[] = [];
			const addAssignee = async (assignee: string) => {
				if (config.vacation?.includes(assignee)) {
					safeLog('not assigning ', assignee, 'becuase they are on vacation');
				} else {
					potentialAssignees.push(assignee);
				}
			};

			const issueData = await issue.getIssue();
			if (!issueData) continue;

			if (issueData.labels.includes('invalid')) {
				safeLog(`issue ${labeling.number} is invalid, skipping`);
				continue;
			}

			if (issueData.number !== labeling.number) {
				safeLog(`issue ${labeling.number} moved to ${issueData.number}, skipping`);
				continue;
			}

			const allLabelsAllowed = issueData.labels.every((issueLabel) =>
				allowLabels.some((allowedLabel) => issueLabel.includes(allowedLabel)),
			);

			if (!debug && (issueData.assignee || !allLabelsAllowed)) {
				safeLog('skipping');
				continue;
			}

			safeLog(
				'not skipping',
				JSON.stringify({
					assignee: labeling.assignee,
					area: labeling.area,
					number: labeling.number,
				}),
			);

			{
				const { category, confidence, confident } = labeling.area;
				if (debug) {
					if (confident) {
						if (!(await github.repoHasLabel(category))) {
							safeLog(`creating label`);
							await github.createLabel(category, 'f1d9ff', '');
						}
						await issue.addLabel(category);
					}
					await issue.postComment(
						`confidence for label ${category}: ${confidence}. ${
							confident ? 'does' : 'does not'
						} meet threshold`,
					);
				}

				if (confident) {
					safeLog(`assigning person based on label ${category} for issue ${issueData.number}`);

					// Assign the issue to the proper person based on the label that was assigned
					// This is configurable in the per repo config
					const labelConfig = config.labels?.[category];
					await Promise.all<any>([
						...(labelConfig?.assign
							? labelConfig.assign.map((assignee) => addAssignee(assignee))
							: []),
					]);
				}
			}

			{
				const { category, confidence, confident } = labeling.assignee;
				if (debug) {
					if (confident) {
						if (!(await github.repoHasLabel(category))) {
							safeLog(`creating assignee label`);
							await github.createLabel(category, 'ffa5a1', '');
						}
						await issue.addLabel(category);
					}
					await issue.postComment(
						`confidence for assignee ${category}: ${confidence}. ${
							confident ? 'does' : 'does not'
						} meet threshold`,
					);
				}

				if (confident) {
					safeLog('has assignee');
					await addAssignee(category);
				}
			}

			let performedAssignment = false;
			if (potentialAssignees.length && !debug) {
				for (const assignee of potentialAssignees) {
					const hasBeenAssigned = await issue.getAssigner(assignee).catch(() => undefined);
					if (!hasBeenAssigned) {
						await issue.addAssignee(assignee);
						performedAssignment = true;
						break;
					}
				}
			}

			if (!performedAssignment) {
				safeLog('could not find assignee, picking a random one...');
				try {
					const vscodeToolsAPI = new VSCodeToolsAPIManager();
					const triagers = await vscodeToolsAPI.getTriagerGitHubIds();
					safeLog('Acquired list of available triagers');
					const available = triagers;
					if (available) {
						// Check if the issue has any cc'ed users and assign them if they are available
						const issueBody = issueData.body;
						const ccMatches = (issueBody.match(/@(\w+)/g) || []).map((match) =>
							match.replace('@', ''),
						);

						for (const ccMatch of ccMatches) {
							if (available.includes(ccMatch)) {
								safeLog("assigning cc'ed user", ccMatch);
								await issue.addAssignee(ccMatch);
								performedAssignment = true;
							}
						}

						if (performedAssignment) {
							continue;
						}

						// Shuffle the array
						for (let i = available.length - 1; i > 0; i--) {
							const j = Math.floor(Math.random() * (i + 1));
							[available[i], available[j]] = [available[j], available[i]];
						}
						if (!debug) {
							await issue.addLabel('triage-needed');
							let i = 0;
							const randomSelection = available[i];
							safeLog('assigning', randomSelection);
							await issue.addAssignee(randomSelection);
							const staleIssues = github.query({
								q: `is:issue is:open label:triage-needed -label:stale -label:info-needed updated:<${daysAgoToHumanReadbleDate(
									7,
								)}`,
							});
							// Loop through assigning new people to issues which are over a week old and not triaged
							for await (const page of staleIssues) {
								for (const issue of page) {
									i += 1;
									if (i >= available.length) {
										i = 0;
									}
									safeLog('assigning to stale issue', available[i]);
									await issue.addAssignee(available[i]);
									await issue.addLabel('stale');
								}
							}
						}
					} else {
						safeLog('could not find manifest');
					}
				} catch (e) {
					safeLog('error assigning random', (e as any).message);
				}
			}
		}
	}
}

new ApplyLabels().run() // eslint-disable-line