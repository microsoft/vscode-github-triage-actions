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
const TestPlanitemValidator_1 = require("./TestPlanitemValidator");
const main = async () => {
    await new TestPlanitemValidator_1.TestPlanItemValidator(new octokit_1.OctoKitIssue(utils_1.getRequiredInput('token'), github_1.context.repo, { number: github_1.context.issue.number }), utils_1.getRequiredInput('label'), utils_1.getRequiredInput('invalidLabel'), utils_1.getRequiredInput('comment')).run();
};
main()
    .then(() => utils_1.logRateLimit(utils_1.getRequiredInput('token')))
    .catch(async (error) => {
    core.setFailed(error.message);
    await utils_1.logErrorToIssue(error, true, utils_1.getRequiredInput('token'));
});
//# sourceMappingURL=index.js.map