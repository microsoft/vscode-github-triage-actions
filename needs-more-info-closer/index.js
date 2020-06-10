"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../common/utils");
const NeedsMoreInfoCloser_1 = require("./NeedsMoreInfoCloser");
const Action_1 = require("../common/Action");
class NeedsMoreInfo extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'NeedsMoreInfo';
    }
    async onTriggered(github) {
        var _a;
        await new NeedsMoreInfoCloser_1.NeedsMoreInfoCloser(github, utils_1.getRequiredInput('label'), +utils_1.getRequiredInput('closeDays'), +utils_1.getRequiredInput('pingDays'), utils_1.getInput('closeComment') || '', utils_1.getInput('pingComment') || '', ((_a = utils_1.getInput('additionalTeam')) !== null && _a !== void 0 ? _a : '').split('|')).run();
    }
}
new NeedsMoreInfo().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map