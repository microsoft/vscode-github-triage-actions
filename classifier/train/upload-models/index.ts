/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as core from '@actions/core'
import { getRequiredInput, logErrorToIssue } from '../../../utils/utils'
import { uploadBlob } from '../../blobStorage'

const token = getRequiredInput('token')
const blobContainer = getRequiredInput('blobContainerName')
const blobStorageKey = getRequiredInput('blobStoragekey')

const main = async () => {
	await uploadBlob('area-model.pickle', blobContainer, blobStorageKey)
	await uploadBlob('area-model-config.json', blobContainer, blobStorageKey)

	await uploadBlob('editor-model.pickle', blobContainer, blobStorageKey)
	await uploadBlob('editor-model-config.json', blobContainer, blobStorageKey)

	await uploadBlob('workbench-model.pickle', blobContainer, blobStorageKey)
	await uploadBlob('workbench-model-config.json', blobContainer, blobStorageKey)
}

main().catch(async (error) => {
	core.setFailed(error.message)
	await logErrorToIssue(error, true, token)
})
