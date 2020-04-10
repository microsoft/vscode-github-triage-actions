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
const RegexLabeler_1 = require("./RegexLabeler");
const main = async () => {
    await new RegexLabeler_1.RegexFlagger(new octokit_1.OctoKitIssue(utils_1.getRequiredInput('token'), github_1.context.repo, { number: github_1.context.issue.number }), utils_1.getInput('label'), utils_1.getInput('comment'), utils_1.getInput('mustMatch'), utils_1.getInput('mustNotMatch')).run();
};
main()
    .then(() => utils_1.logRateLimit(utils_1.getRequiredInput('token')))
    .catch(async (error) => {
    core.setFailed(error.message);
    await utils_1.logErrorToIssue(error.message, true, utils_1.getRequiredInput('token'));
});
//# sourceMappingURL=index.js.map