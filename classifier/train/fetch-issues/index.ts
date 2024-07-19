/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { statSync } from 'fs';
import { join } from 'path';
import { Action } from '../../../common/Action';
import { getInput, getRequiredInput } from '../../../common/utils';
import { createDataDirectories } from './createDataDir';
import { download } from './download';

const endCursor = getInput('cursor');
const owner = getRequiredInput('owner');
const repo = getRequiredInput('repo');
const areas = getRequiredInput('areas').split('|');
const assignees = getRequiredInput('assignees').split('|');

class FetchIssues extends Action {
	id = 'Classifier/Train/FetchIssues';

	async onTriggered() {
		if (endCursor) {
			await download({ owner, repo }, endCursor);
		} else {
			try {
				statSync(join(__dirname, 'issues.json')).isFile();
			} catch {
				await download({ owner, repo });
			}
		}
		await new Promise((resolve) => setTimeout(resolve, 1000));
		await createDataDirectories(areas, assignees);
	}
}

new FetchIssues().run() // eslint-disable-line