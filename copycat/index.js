"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const Action_1 = require("../common/Action");
const utils_1 = require("../common/utils");
const CopyCat_1 = require("./CopyCat");
class CopyCatAction extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'CopyCat';
    }
    async onOpened(issue) {
        await new CopyCat_1.CopyCat(issue, (0, utils_1.getRequiredInput)('destinationOwner'), (0, utils_1.getRequiredInput)('destinationRepo')).run();
    }
}
new CopyCatAction().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map