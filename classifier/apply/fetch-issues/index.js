"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const core = require("@actions/core");
const fs_1 = require("fs");
const path_1 = require("path");
const github_1 = require("@actions/github");
const octokit_1 = require("../../../api/octokit");
const utils_1 = require("../../../utils/utils");
const minToDay = 0.0007;
const token = utils_1.getRequiredInput('token');
const from = utils_1.daysAgoToHumanReadbleDate(+utils_1.getRequiredInput('from') * minToDay);
const until = utils_1.daysAgoToHumanReadbleDate(+utils_1.getRequiredInput('until') * minToDay);
const main = async () => {
    const github = new octokit_1.OctoKit(token, github_1.context.repo);
    const query = `created:>${from} updated:<${until} is:open`;
    const data = [];
    for await (const page of github.query({ q: query })) {
        for (const issue of page) {
            const issueData = await issue.getIssue();
            const cleansed = utils_1.normalizeIssue(issueData);
            data.push({ number: issueData.number, contents: `${cleansed.title}\n\n${cleansed.body}` });
        }
    }
    console.log('Got issues', JSON.stringify(data, null, 2));
    fs_1.writeFileSync(path_1.join(__dirname, '../issue_data.json'), JSON.stringify(data));
};
main()
    .then(() => utils_1.logRateLimit(token))
    .catch(async (error) => {
    core.setFailed(error.message);
    await utils_1.logErrorToIssue(error, true, token);
});
//# sourceMappingURL=index.js.map