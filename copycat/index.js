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
const CopyCat_1 = require("./CopyCat");
const token = utils_1.getRequiredInput('token');
const main = async () => {
    await new CopyCat_1.CopyCat(new octokit_1.OctoKitIssue(token, github_1.context.repo, { number: github_1.context.issue.number }), utils_1.getRequiredInput('owner'), utils_1.getRequiredInput('repo')).run();
};
main()
    .then(() => utils_1.logRateLimit(token))
    .catch(async (error) => {
    core.setFailed(error.message);
    await utils_1.logErrorToIssue(error, true, token);
});
//# sourceMappingURL=index.js.map