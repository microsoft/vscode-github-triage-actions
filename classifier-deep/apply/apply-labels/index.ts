/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mongodb from 'mongodb';
import { readFileSync } from 'fs';
import { join } from 'path';
import { context } from '@actions/github';
import { OctoKit, OctoKitIssue } from '../../../api/octokit';
import { getRequiredInput, getInput, safeLog, daysAgoToHumanReadbleDate } from '../../../common/utils';
import { Action } from '../../../common/Action';

const token = getRequiredInput('token');
const manifestDbConnectionString = getInput('manifestDbConnectionString');

const allowLabels = (getInput('allowLabels') || '').split('|');
const debug = !!getInput('__debug');

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

type Triager = {
	id: string;
	triager: boolean;
	availability: Availability;
};

class ApplyLabels extends Action {
	id = 'Classifier-Deep/Apply/ApplyLabels';

	async onTriggered(github: OctoKit) {
		let manifest: Promise<string[] | undefined> = Promise.resolve(undefined);

		if (manifestDbConnectionString) {
			safeLog('has manifestDbConnectionString');
			manifest = mongodb.MongoClient.connect(manifestDbConnectionString).then(async (client) => {
				safeLog('connected to db');
				try {
					// Get the database from the mongo client
					const db = client.db('admin');
					const collection = db.collection('testers');
					const triagers = await collection.find<Triager>({}).toArray();
					return triagers
						.filter((t) => t.triager && t.availability !== Availability.NOT_AVAILABLE)
						.map((t) => t.id);
				} catch (e) {
					safeLog('error reading from db');
					safeLog((e as any).message);
				} finally {
					safeLog('disconnected from db');
					// eslint-disable-next-line @typescript-eslint/no-floating-promises
					client.close();
				}
			});
		} else {
			safeLog('has no manifestDbConnectionString');
		}

		const config: ClassifierConfig = await github.readConfig(getRequiredInput('configPath'));
		const labelings: LabelingsFile = JSON.parse(
			readFileSync(join(__dirname, '../issue_labels.json'), { encoding: 'utf8' }),
		);

		for (const labeling of labelings) {
			const issue = new OctoKitIssue(token, context.repo, { number: labeling.number });

			const potentialAssignees: string[] = [];
			const addAssignee = async (assignee: string) => {
				if (config.vacation?.includes(assignee)) {
					safeLog('not assigning ', assignee, 'becuase they are on vacation');
				} else {
					potentialAssignees.push(assignee);
				}
			};

			const issueData = await issue.getIssue();

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
					const available = await manifest;
					if (available) {
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