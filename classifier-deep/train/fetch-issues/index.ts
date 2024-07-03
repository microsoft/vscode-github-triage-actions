/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { context } from '@actions/github';
import { execSync } from 'child_process';
import { statSync } from 'fs';
import { join } from 'path';
import { Action } from '../../../common/Action';
import { getInput, getRequiredInput } from '../../../common/utils';
import { uploadBlobFile } from '../../blobStorage';
import { download } from './download';

const token = getRequiredInput('token');
const endCursor = getInput('cursor');

const blobContainer = getRequiredInput('blobContainerName');

class FetchIssues extends Action {
	id = 'Classifier/Train/FetchIssues';

	async onTriggered() {
		if (endCursor) {
			await download(token, context.repo, endCursor);
		} else {
			try {
				statSync(join(__dirname, 'issues.json')).isFile();
			} catch {
				await download(token, context.repo);
			}
		}
		await new Promise((resolve) => setTimeout(resolve, 1000));
		execSync(
			`zip -q ${join(__dirname, '..', '..', 'blobStorage', 'issues.json.zip')} ${join(
				__dirname,
				'issues.json',
			)}`,
		);

		await uploadBlobFile('issues.json.zip', blobContainer);
	}
}

new FetchIssues().run() // eslint-disable-line