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
const Commands_1 = require("./Commands");
const token = utils_1.getRequiredInput('token');
const main = async () => {
    const octokit = new octokit_1.OctoKitIssue(token, github_1.context.repo, {
        number: github_1.context.issue.number,
    });
    const commands = await octokit.readConfig(utils_1.getRequiredInput('config-path'));
    const action = github_1.context.eventName === 'issue_comment'
        ? {
            comment: github_1.context.payload.comment.body,
            user: { name: github_1.context.actor, isGitHubApp: undefined },
        }
        : { label: github_1.context.payload.label.name };
    await new Commands_1.Commands(octokit, commands, action).run();
};
main()
    .then(() => utils_1.logRateLimit(token))
    .catch(async (error) => {
    core.setFailed(error.message);
    await utils_1.logErrorToIssue(error, true, token);
});
//# sourceMappingURL=index.js.map