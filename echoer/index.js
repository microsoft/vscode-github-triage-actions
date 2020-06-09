"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const core = require("@actions/core");
const github_1 = require("@actions/github");
const utils_1 = require("../common/utils");
const main = async () => {
    // Get the JSON webhook payload for the event that triggered the workflow
    const payload = JSON.stringify(github_1.context, undefined, 2);
    console.log(`The event payload: ${payload}`);
};
main()
    .then(() => utils_1.logRateLimit(utils_1.getRequiredInput('token')))
    .catch(async (error) => {
    core.setFailed(error.message);
    await utils_1.logErrorToIssue(error, true, utils_1.getRequiredInput('token'));
});
//# sourceMappingURL=index.js.map