"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const core = require("@actions/core");
const github_1 = require("@actions/github");
const octokit_1 = require("../api/octokit");
const utils_1 = require("../common/utils");
const NeedsMoreInfoCloser_1 = require("./NeedsMoreInfoCloser");
const token = utils_1.getRequiredInput('token');
const main = async () => {
    var _a;
    if (github_1.context.eventName === 'repository_dispatch' &&
        github_1.context.payload.action !== 'trigger_needs_more_info_closer') {
        return;
    }
    await new NeedsMoreInfoCloser_1.NeedsMoreInfoCloser(new octokit_1.OctoKit(token, github_1.context.repo), utils_1.getRequiredInput('label'), +utils_1.getRequiredInput('closeDays'), +utils_1.getRequiredInput('pingDays'), utils_1.getInput('closeComment') || '', utils_1.getInput('pingComment') || '', ((_a = utils_1.getInput('additionalTeam')) !== null && _a !== void 0 ? _a : '').split('|')).run();
};
main()
    .then(() => utils_1.logRateLimit(token))
    .catch(async (error) => {
    core.setFailed(error.message);
    await utils_1.logErrorToIssue(error, true, token);
});
//# sourceMappingURL=index.js.map