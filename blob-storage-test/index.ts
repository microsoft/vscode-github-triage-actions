/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getRequiredInput } from '../common/utils'
import { uploadBlobText } from '../classifier/blobStorage'
import { Action } from '../common/Action'
import { OctoKitIssue } from '../api/octokit'

// import { setLogLevel } from '@azure/logger'
// setLogLevel('info')

const storageKey = getRequiredInput('storageKey')

class BlobTest extends Action {
	id = 'BlobTest'

	async onCommented(_issue: OctoKitIssue, comment: string, _actor: string) {
		await uploadBlobText('test-ignore', comment, 'latest-releases', storageKey)
	}
}

new BlobTest().run() // eslint-disable-line
