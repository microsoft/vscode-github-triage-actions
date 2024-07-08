/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from '../../../common/Action';
import { getRequiredInput, safeLog } from '../../../common/utils';
import { uploadBlobFile } from '../../blobStorage';

const blobContainer = getRequiredInput('blobContainerName');

class UploadModels extends Action {
	id = 'Classifier/Train/UploadModels';

	async onTriggered() {
		safeLog('uploading area-model.pickle');
		await uploadBlobFile('area-model.pickle', blobContainer);
		safeLog('done');

		safeLog('uploading area-model-config.json');
		await uploadBlobFile('area-model-config.json', blobContainer);
		safeLog('done');

		safeLog('uploading assignee-model.pickle');
		await uploadBlobFile('assignee-model.pickle', blobContainer);
		safeLog('done');

		safeLog('uploading assignee-model-config.json');
		await uploadBlobFile('assignee-model-config.json', blobContainer);
		safeLog('done');
	}
}

new UploadModels().run() // eslint-disable-line