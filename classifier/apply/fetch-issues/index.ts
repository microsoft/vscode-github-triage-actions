/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { writeFileSync } from 'fs';
import { join } from 'path';
import { OctoKit } from '../../../api/octokit';
import { Action } from '../../../common/Action';
import { daysAgoToHumanReadbleDate, getRequiredInput, normalizeIssue, safeLog } from '../../../common/utils';
import { downloadBlobFile } from '../../blobStorage';

const minToDay = 0.0007;
const from = daysAgoToHumanReadbleDate(+getRequiredInput('from') * minToDay);
const until = daysAgoToHumanReadbleDate(+getRequiredInput('until') * minToDay);
const owner = getRequiredInput('owner');
const repo = getRequiredInput('repo');
const blobContainer = getRequiredInput('blobContainerName');

class FetchIssues extends Action {
	id = 'Clasifier/Apply/FetchIssues';

	async onTriggered(github: OctoKit) {
		const query = `repo:${owner}/${repo} created:>${from} updated:<${until} is:open type:issue`;

		safeLog(`Querying for issues: ${query}`);

		const data: { number: number; contents: string }[] = [];
		for await (const page of github.query({ q: query })) {
			for (const issue of page) {
				const issueData = await issue.getIssue();
				if (!issueData) continue;
				const cleansed = normalizeIssue(issueData);
				data.push({ number: issueData.number, contents: `${cleansed.title}\n\n${cleansed.body}` });
			}
		}

		writeFileSync(join(__dirname, '../issue_data.json'), JSON.stringify(data));

		await downloadBlobFile('area-model.pickle', blobContainer);
		await downloadBlobFile('area-model-config.json', blobContainer);

		await downloadBlobFile('assignee-model.pickle', blobContainer);
		await downloadBlobFile('assignee-model-config.json', blobContainer);
	}
}

new FetchIssues().run() // eslint-disable-line
