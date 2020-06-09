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
const ReleasePipeline_1 = require("./ReleasePipeline");
const token = utils_1.getRequiredInput('token');
const main = async () => {
    const notYetReleasedLabel = utils_1.getRequiredInput('notYetReleasedLabel');
    const insidersReleasedLabel = utils_1.getRequiredInput('insidersReleasedLabel');
    if (github_1.context.eventName === 'issues') {
        if (github_1.context.payload.action === 'reopened') {
            await ReleasePipeline_1.unenrollIssue(new octokit_1.OctoKitIssue(token, github_1.context.repo, { number: github_1.context.issue.number }), notYetReleasedLabel, insidersReleasedLabel);
        }
        else {
            await ReleasePipeline_1.enrollIssue(new octokit_1.OctoKitIssue(token, github_1.context.repo, { number: github_1.context.issue.number }), notYetReleasedLabel);
        }
    }
    else {
        await new ReleasePipeline_1.ReleasePipeline(new octokit_1.OctoKit(token, github_1.context.repo), notYetReleasedLabel, insidersReleasedLabel).run();
    }
};
main()
    .then(() => utils_1.logRateLimit(token))
    .catch(async (error) => {
    core.setFailed(error.message);
    await utils_1.logErrorToIssue(error, true, token);
});
//# sourceMappingURL=index.js.map