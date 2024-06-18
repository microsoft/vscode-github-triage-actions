"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const Action_1 = require("../common/Action");
const ValidtyChecker_1 = require("./ValidtyChecker");
class ValidtyCheckerAction extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'ValidtyChecker';
    }
    async onOpened(issue) {
        await new ValidtyChecker_1.ValidtyChecker(issue).run();
    }
    async onReopened(issue) {
        await new ValidtyChecker_1.ValidtyChecker(issue).run();
    }
}
new ValidtyCheckerAction().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map