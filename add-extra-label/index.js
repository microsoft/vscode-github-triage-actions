"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../common/utils");
const addExtraLabel_1 = require("./addExtraLabel");
const Action_1 = require("../common/Action");
class AddExtraLabelAction extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'AddExtraLabel';
    }
    async onOpened(issue) {
        await new addExtraLabel_1.AddExtraLabel(issue, utils_1.getRequiredInput('newLabel')).run();
    }
}
new AddExtraLabelAction().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map