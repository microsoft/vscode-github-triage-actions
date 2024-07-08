"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const blobStorage_1 = require("../classifier/blobStorage");
const Action_1 = require("../common/Action");
class BlobTest extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'BlobTest';
    }
    async onCommented(_issue, comment, _actor) {
        await (0, blobStorage_1.uploadBlobText)('test-ignore', comment, 'latest-releases');
    }
}
new BlobTest().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map