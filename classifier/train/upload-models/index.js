"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const Action_1 = require("../../../common/Action");
const utils_1 = require("../../../common/utils");
const blobStorage_1 = require("../../blobStorage");
const blobContainer = (0, utils_1.getRequiredInput)('blobContainerName');
class UploadModels extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'Classifier/Train/UploadModels';
    }
    async onTriggered() {
        (0, utils_1.safeLog)('uploading area-model.pickle');
        await (0, blobStorage_1.uploadBlobFile)('area-model.pickle', blobContainer);
        (0, utils_1.safeLog)('done');
        (0, utils_1.safeLog)('uploading area-model-config.json');
        await (0, blobStorage_1.uploadBlobFile)('area-model-config.json', blobContainer);
        (0, utils_1.safeLog)('done');
        (0, utils_1.safeLog)('uploading assignee-model.pickle');
        await (0, blobStorage_1.uploadBlobFile)('assignee-model.pickle', blobContainer);
        (0, utils_1.safeLog)('done');
        (0, utils_1.safeLog)('uploading assignee-model-config.json');
        await (0, blobStorage_1.uploadBlobFile)('assignee-model-config.json', blobContainer);
        (0, utils_1.safeLog)('done');
    }
}
new UploadModels().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map