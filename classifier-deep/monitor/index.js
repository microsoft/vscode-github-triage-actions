"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const Action_1 = require("../../common/Action");
const utils_1 = require("../../common/utils");
class DeepClassifierMonitor extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'Classifier-Deep/Monitor';
    }
    async onAssigned(issue, assignee) {
        (0, utils_1.safeLog)(`Assigned to ${assignee}`);
        const assigner = await issue.getAssigner(assignee);
        if (assigner !== (0, utils_1.getRequiredInput)('botName')) {
            (0, utils_1.safeLog)(`Assigner: ${assigner}`);
            await issue.removeLabel('triage-needed');
            await issue.removeLabel('stale');
        }
    }
    async onUnassigned(_issue, _assignee) {
        // no-op
    }
}
new DeepClassifierMonitor().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map