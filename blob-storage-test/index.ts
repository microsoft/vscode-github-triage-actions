/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OctoKitIssue } from '../api/octokit';
import { uploadBlobText } from '../classifier/blobStorage';
import { Action } from '../common/Action';

class BlobTest extends Action {
	id = 'BlobTest';

	async onCommented(_issue: OctoKitIssue, comment: string, _actor: string) {
		await uploadBlobText('test-ignore', comment, 'latest-releases');
	}
}

new BlobTest().run() // eslint-disable-line
