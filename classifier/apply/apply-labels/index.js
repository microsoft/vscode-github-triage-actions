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
const token = utils_1.getRequiredInput('token');
const allowLabels = (utils_1.getInput('allowLabels') || '').split('|');
const debug = !!utils_1.getInput('__debug');
const main = async () => {
    var _a, _b;
    console.log('hello');
    const github = new octokit_1.OctoKit(token, github_1.context.repo);
    const config = await github.readConfig(utils_1.getRequiredInput('config-path'));
    const labelings = JSON.parse(fs_1.readFileSync(path_1.join(__dirname, '../issue_labels.json'), { encoding: 'utf8' }));
    console.log('labelings:', labelings);
    for (const labeling of labelings) {
        const label = labeling.labels.length === 1 ? labeling.labels[0] : undefined;
        if (!label) {
            continue;
        }
        const issue = new octokit_1.OctoKitIssue(token, github_1.context.repo, { number: labeling.number });
        const issueData = await issue.getIssue();
        if (!debug &&
            (issueData.assignee ||
                issueData.numComments ||
                issueData.labels.some((label) => !allowLabels.includes(label)))) {
            continue;
        }
        console.log(`adding label ${label} to issue ${issueData.number}`);
        if (debug) {
            console.log(`create labels enabled`);
            if (!(await github.repoHasLabel(label))) {
                console.log(`creating label`);
                await github.createLabel(label, 'f1d9ff', '');
            }
        }
        const assignee = labeling.assignee;
        if (assignee && debug) {
            if (!(await github.repoHasLabel(label))) {
                console.log(`creating assignee label`);
                await github.createLabel(assignee, 'ffa5a1', '');
            }
            await issue.addLabel(assignee);
        }
        const labelConfig = (_a = config.labels) === null || _a === void 0 ? void 0 : _a[label];
        const assigneeConfig = (_b = config.assignees) === null || _b === void 0 ? void 0 : _b[assignee];
        await Promise.all([
            (labelConfig === null || labelConfig === void 0 ? void 0 : labelConfig.assignLabel) || debug ? issue.addLabel(label) : Promise.resolve,
            (labelConfig === null || labelConfig === void 0 ? void 0 : labelConfig.comment) ? issue.postComment(labelConfig.comment) : Promise.resolve(),
            ...((labelConfig === null || labelConfig === void 0 ? void 0 : labelConfig.assign) ? labelConfig.assign.map((assignee) => issue.addAssignee(assignee)) : []),
            (assigneeConfig === null || assigneeConfig === void 0 ? void 0 : assigneeConfig.assign) || debug ? issue.addAssignee(assignee) : Promise.resolve(),
            (assigneeConfig === null || assigneeConfig === void 0 ? void 0 : assigneeConfig.comment) ? issue.postComment(assigneeConfig.comment) : Promise.resolve(),
        ]);
    }
};
main()
    .then(() => utils_1.logRateLimit(token))
    .catch(async (error) => {
    core.setFailed(error.message);
    await utils_1.logErrorToIssue(error, true, token);
});
//# sourceMappingURL=index.js.map