"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const core = require("@actions/core");
const github_1 = require("@actions/github");
const octokit_1 = require("../api/octokit");
const utils_1 = require("../utils/utils");
const Locker_1 = require("./Locker");
const token = utils_1.getRequiredInput('token');
const main = async () => {
    if (github_1.context.eventName === 'repository_dispatch' && github_1.context.payload.action !== 'trigger_locker') {
        return;
    }
    await new Locker_1.Locker(new octokit_1.OctoKit(token, github_1.context.repo), +utils_1.getRequiredInput('daysSinceClose'), +utils_1.getRequiredInput('daysSinceUpdate'), utils_1.getInput('ignoredLabel') || undefined).run();
};
main()
    .then(() => utils_1.logRateLimit(token))
    .catch(async (error) => {
    core.setFailed(error.message);
    await utils_1.logErrorToIssue(error, true, token);
});
//# sourceMappingURL=index.js.map