"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../common/utils");
const Locker_1 = require("./Locker");
const Action_1 = require("../common/Action");
class LockerAction extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'Locker';
    }
    async onTriggered(github) {
        await new Locker_1.Locker(github, +utils_1.getRequiredInput('daysSinceClose'), +utils_1.getRequiredInput('daysSinceUpdate'), utils_1.getInput('ignoredLabel') || undefined, utils_1.getInput('ignoreLabelUntil') || undefined, utils_1.getInput('labelUntil') || undefined).run();
    }
}
new LockerAction().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map