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
const token = utils_1.getRequiredInput('token');
const main = async () => {
    const comment = github_1.context.payload.comment.body;
    if (comment.indexOf('/query') !== 0) {
        return;
    }
    const query = comment.substr(7);
    const octokit = new octokit_1.OctoKit(token, github_1.context.repo);
    for await (const pageData of octokit.query({ q: query })) {
        for (const issue of pageData) {
            console.log((await issue.getIssue()).title);
        }
    }
};
main()
    .then(() => utils_1.logRateLimit(token))
    .catch(async (error) => {
    core.setFailed(error.message);
    await utils_1.logErrorToIssue(error.message, true, token);
});
//# sourceMappingURL=index.js.map