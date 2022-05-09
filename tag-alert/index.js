"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../common/utils");
const Action_1 = require("../common/Action");
class TagAlert extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'TagAlert';
    }
    async onCreated(_github, ref, creator) {
        if ((0, utils_1.getRequiredInput)('tag-name') === ref) {
            throw Error(`Warning: @${creator} pushed bad tag ${ref}`);
        }
    }
}
new TagAlert().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map