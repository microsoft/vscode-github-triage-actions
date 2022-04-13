"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../common/utils");
const NewRelease_1 = require("./NewRelease");
const Action_1 = require("../common/Action");
class NewReleaseAction extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'NewRelease';
    }
    async onOpened(issue) {
        await new NewRelease_1.NewRelease(issue, (0, utils_1.getRequiredInput)('label'), (0, utils_1.getRequiredInput)('labelColor'), (0, utils_1.getRequiredInput)('labelDescription'), +(0, utils_1.getRequiredInput)('days')).run();
    }
}
new NewReleaseAction().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map