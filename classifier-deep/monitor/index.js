"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const Action_1 = require("../../common/Action");
const utils_1 = require("../../common/utils");
const telemetry_1 = require("../../common/telemetry");
class DeepClassifierMonitor extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'Classifier-Deep/Monitor';
    }
    async onAssigned(issue, assignee) {
        const assigner = await issue.getAssigner(assignee);
        if (assigner !== utils_1.getRequiredInput('botName')) {
            await issue.removeLabel('triage-needed');
        }
    }
    async onUnassigned(issue, assignee) {
        try {
            const assigner = await issue.getAssigner(assignee);
            if (assigner === utils_1.getRequiredInput('botName')) {
                await telemetry_1.trackEvent(issue, 'deep-classifier:unassigned', { assignee });
            }
        }
        catch {
            // issue deleted or something, just ignore
            utils_1.safeLog('error reading unassign data');
        }
    }
}
new DeepClassifierMonitor().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map