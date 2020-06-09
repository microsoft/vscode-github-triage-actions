/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as core from '@actions/core'
import { getRequiredInput, logErrorToIssue } from '../../../utils/utils'
import { uploadBlobFile } from '../../blobStorage'

const token = getRequiredInput('token')
const blobContainer = getRequiredInput('blobContainerName')
const blobStorageKey = getRequiredInput('blobStoragekey')

const main = async () => {
	console.log('uploading area-model.pickle')
	await uploadBlobFile('area-model.pickle', blobContainer, blobStorageKey)
	console.log('done')

	console.log('uploading area-model-config.json')
	await uploadBlobFile('area-model-config.json', blobContainer, blobStorageKey)
	console.log('done')

	console.log('uploading assignee-model.pickle')
	await uploadBlobFile('assignee-model.pickle', blobContainer, blobStorageKey)
	console.log('done')

	console.log('uploading assignee-model-config.json')
	await uploadBlobFile('assignee-model-config.json', blobContainer, blobStorageKey)
	console.log('done')
}

main().catch(async (error) => {
	core.setFailed(error.message)
	await logErrorToIssue(error, true, token)
})
