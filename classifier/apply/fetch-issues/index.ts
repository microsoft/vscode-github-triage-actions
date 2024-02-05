/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { writeFileSync } from 'fs';
import { join } from 'path';
import { OctoKit } from '../../../api/octokit';
import { getRequiredInput, daysAgoToHumanReadbleDate, normalizeIssue, safeLog } from '../../../common/utils';
import { downloadBlobFile } from '../../blobStorage';
import { Action } from '../../../common/Action';

const minToDay = 0.0007;
const from = daysAgoToHumanReadbleDate(+getRequiredInput('from') * minToDay);
const until = daysAgoToHumanReadbleDate(+getRequiredInput('until') * minToDay);

const blobContainer = getRequiredInput('blobContainerName');
const blobStorageKey = getRequiredInput('blobStorageKey');

class FetchIssues extends Action {
	id = 'Clasifier/Apply/FetchIssues';

	async onTriggered(github: OctoKit) {
		const query = `created:>${from} updated:<${until} is:open`;

		safeLog(`Querying for issues: ${query}`);

		const data: { number: number; contents: string }[] = [];
		for await (const page of github.query({ q: query })) {
			for (const issue of page) {
				const issueData = await issue.getIssue();
				const cleansed = normalizeIssue(issueData);
				data.push({ number: issueData.number, contents: `${cleansed.title}\n\n${cleansed.body}` });
			}
		}

		writeFileSync(join(__dirname, '../issue_data.json'), JSON.stringify(data));

		await downloadBlobFile('area-model.pickle', blobContainer, blobStorageKey);
		await downloadBlobFile('area-model-config.json', blobContainer, blobStorageKey);

		await downloadBlobFile('assignee-model.pickle', blobContainer, blobStorageKey);
		await downloadBlobFile('assignee-model-config.json', blobContainer, blobStorageKey);
	}
}

new FetchIssues().run() // eslint-disable-line
