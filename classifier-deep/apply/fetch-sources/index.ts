/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getInput, setFailed } from '@actions/core';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { OctoKit } from '../../../api/octokit';
import { Action } from '../../../common/Action';
import { daysAgoToHumanReadbleDate, getRequiredInput, normalizeIssue, safeLog } from '../../../common/utils';
import { downloadBlobFile } from '../../blobStorage';

const minToDay = 0.0007;
const fromInput = getInput('from') || undefined;
const excludeLabels = (getInput('excludeLabels') || '')
	.split('|')
	.map((l) => `-label:${l}`)
	.join(' ');
const from = fromInput ? daysAgoToHumanReadbleDate(+fromInput * minToDay) : undefined;
const until = daysAgoToHumanReadbleDate(+getRequiredInput('until') * minToDay);

const createdQuery = `created:` + (from ? `${from}..${until}` : `<${until}`);

const blobContainer = getRequiredInput('blobContainerName');
const repo = getRequiredInput('repo');
const owner = getRequiredInput('owner');
class FetchIssues extends Action {
	id = 'Clasifier-Deep/Apply/FetchIssues';

	async onTriggered(github: OctoKit) {
		const query = `repo:${owner}/${repo} ${createdQuery} is:open no:assignee ${excludeLabels}`;

		const data: { number: number; contents: string }[] = [];
		for await (const page of github.query({ q: query })) {
			for (const issue of page) {
				const issueData = await issue.getIssue();
				if (!issueData) continue;

				// Probably spam. Tagged for later review
				if (issueData.author.name === 'ghost') {
					safeLog(`Tagging issue  #${issueData.number} as invalid`);
					try {
						await issue.addLabel('invalid');
						await issue.closeIssue('not_planned');
						await issue.lockIssue();
					} catch (e) {
						safeLog(`Failed to triage invalid issue #${issueData.number}: ${e}`);
					}
					continue;
				}

				let performedPRAssignment = false;
				let additionalInfo = '';
				if (issueData.isPr) {
					if (await github.hasWriteAccess(issueData.author.name)) {
						await issue.addAssignee(issueData.author.name);
						performedPRAssignment = true;
					} else {
						try {
							safeLog('issue is a PR, attempting to read find a linked issue');
							const linkedIssue = issueData.body.match(/#(\d{3,7})/)?.[1];
							if (linkedIssue) {
								safeLog('PR is linked to', linkedIssue);
								const linkedIssueData = await github
									.getIssueByNumber(+linkedIssue)
									.getIssue();
								if (!linkedIssueData) continue;

								const normalized = normalizeIssue(linkedIssueData);
								additionalInfo = `\n\n${normalized.title}\n\n${normalized.body}`;
								const linkedIssueAssignee = linkedIssueData.assignees[0];
								if (linkedIssueAssignee) {
									safeLog('linked issue is assigned to', linkedIssueAssignee);
									await issue.addAssignee(linkedIssueAssignee);
									performedPRAssignment = true;
								} else {
									safeLog(
										'unable to find assignee for linked issue. falling back to normal classification',
									);
								}
							}
						} catch (e) {
							safeLog(
								'Encountered error finding linked issue assignee. Falling back to normal classification',
							);
						}
					}
				}
				if (!performedPRAssignment) {
					const cleansed = normalizeIssue(issueData);
					data.push({
						number: issueData.number,
						contents: `${cleansed.title}\n\n${cleansed.body}` + additionalInfo,
					});
				}
			}
		}

		writeFileSync(join(__dirname, '../issue_data.json'), JSON.stringify(data));

		const config = await github.readConfig(getRequiredInput('configPath'));
		writeFileSync(join(__dirname, '../configuration.json'), JSON.stringify(config));

		safeLog('dowloading area model');
		await downloadBlobFile('area_model.zip', blobContainer);
		safeLog('dowloading assignee model');
		await downloadBlobFile('assignee_model.zip', blobContainer);

		const classifierDeepRoot = join(__dirname, '..', '..');
		const blobStorage = join(classifierDeepRoot, 'blobStorage');
		const models = join(classifierDeepRoot, 'apply');

		safeLog('unzipping area model');
		execSync(`unzip -q ${join(blobStorage, 'area_model.zip')} -d ${join(models, 'area_model')}`);
		safeLog('unzipping assignee model');
		execSync(`unzip -q ${join(blobStorage, 'assignee_model.zip')} -d ${join(models, 'assignee_model')}`);
	}
}

new FetchIssues().run().catch((e) => setFailed(e.message));
