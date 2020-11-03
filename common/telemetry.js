"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const github_1 = require("@actions/github");
const appInsights = require("applicationinsights");
const utils_1 = require("./utils");
let _aiHandle = undefined;
const aiKey = utils_1.getInput('appInsightsKey');
if (aiKey) {
    appInsights
        .setup(aiKey)
        .setAutoDependencyCorrelation(false)
        .setAutoCollectRequests(false)
        .setAutoCollectPerformance(false, false)
        .setAutoCollectExceptions(false)
        .setAutoCollectDependencies(false)
        .setAutoCollectConsole(false)
        .setUseDiskRetryCaching(false)
        .start();
    _aiHandle = appInsights.defaultClient;
}
exports.aiHandle = _aiHandle;
exports.trackEvent = async (issue, event, props) => {
    if (exports.aiHandle) {
        exports.aiHandle.trackEvent({
            name: event,
            properties: {
                repo: `${github_1.context.repo.owner}/${github_1.context.repo.repo}`,
                issue: '' + (await issue.getIssue()).number,
                workflow: github_1.context.workflow,
                ...props,
            },
        });
    }
};
//# sourceMappingURL=telemetry.js.map