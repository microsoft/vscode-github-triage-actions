"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const core = require("@actions/core");
const utils_1 = require("../../../utils/utils");
const blobStorage_1 = require("../../blobStorage");
const token = utils_1.getRequiredInput('token');
const blobContainer = utils_1.getRequiredInput('blobContainerName');
const blobStorageKey = utils_1.getRequiredInput('blobStoragekey');
const main = async () => {
    console.log('uploading area-model.pickle');
    await blobStorage_1.uploadBlobFile('area-model.pickle', blobContainer, blobStorageKey);
    console.log('done');
    console.log('uploading area-model-config.json');
    await blobStorage_1.uploadBlobFile('area-model-config.json', blobContainer, blobStorageKey);
    console.log('done');
    console.log('uploading editor-model.pickle');
    await blobStorage_1.uploadBlobFile('editor-model.pickle', blobContainer, blobStorageKey);
    console.log('done');
    console.log('uploading editor-model-config.json');
    await blobStorage_1.uploadBlobFile('editor-model-config.json', blobContainer, blobStorageKey);
    console.log('done');
    console.log('uploading workbench-model.pickle');
    await blobStorage_1.uploadBlobFile('workbench-model.pickle', blobContainer, blobStorageKey);
    console.log('done');
    console.log('uploading workbench-model-config.json');
    await blobStorage_1.uploadBlobFile('workbench-model-config.json', blobContainer, blobStorageKey);
    console.log('done');
    console.log('uploading assignee-model.pickle');
    await blobStorage_1.uploadBlobFile('assignee-model.pickle', blobContainer, blobStorageKey);
    console.log('done');
    console.log('uploading assignee-model-config.json');
    await blobStorage_1.uploadBlobFile('assignee-model-config.json', blobContainer, blobStorageKey);
    console.log('done');
};
main().catch(async (error) => {
    core.setFailed(error.message);
    await utils_1.logErrorToIssue(error, true, token);
});
//# sourceMappingURL=index.js.map