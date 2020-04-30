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
    await blobStorage_1.uploadBlob('area-model.pickle', blobContainer, blobStorageKey);
    await blobStorage_1.uploadBlob('area-model-config.json', blobContainer, blobStorageKey);
    await blobStorage_1.uploadBlob('editor-model.pickle', blobContainer, blobStorageKey);
    await blobStorage_1.uploadBlob('editor-model-config.json', blobContainer, blobStorageKey);
    await blobStorage_1.uploadBlob('workbench-model.pickle', blobContainer, blobStorageKey);
    await blobStorage_1.uploadBlob('workbench-model-config.json', blobContainer, blobStorageKey);
};
main().catch(async (error) => {
    core.setFailed(error.message);
    await utils_1.logErrorToIssue(error, true, token);
});
//# sourceMappingURL=index.js.map