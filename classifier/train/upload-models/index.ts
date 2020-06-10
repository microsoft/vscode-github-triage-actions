/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getRequiredInput } from '../../../common/utils'
import { uploadBlobFile } from '../../blobStorage'
import { Action } from '../../../common/Action'

const blobContainer = getRequiredInput('blobContainerName')
const blobStorageKey = getRequiredInput('blobStoragekey')

class UploadModels extends Action {
	id = 'Classifier/Train/UploadModels'

	async onTriggered() {
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
}

new UploadModels().run() // eslint-disable-line