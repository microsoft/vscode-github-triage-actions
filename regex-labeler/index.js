"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const Action_1 = require("../common/Action");
const utils_1 = require("../common/utils");
const RegexLabeler_1 = require("./RegexLabeler");
class RegexFlaggerActon extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'RegexFlagger';
    }
    async onOpened(issue) {
        await new RegexLabeler_1.RegexFlagger(issue, (0, utils_1.getInput)('label'), (0, utils_1.getInput)('comment'), (0, utils_1.getInput)('mustMatch'), (0, utils_1.getInput)('mustNotMatch')).run();
    }
}
new RegexFlaggerActon().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map