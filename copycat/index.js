"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../common/utils");
const CopyCat_1 = require("./CopyCat");
const Action_1 = require("../common/Action");
class CopyCatAction extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'CopyCat';
    }
    async onOpened(issue) {
        await new CopyCat_1.CopyCat(issue, (0, utils_1.getRequiredInput)('owner'), (0, utils_1.getRequiredInput)('repo')).run();
    }
}
new CopyCatAction().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map