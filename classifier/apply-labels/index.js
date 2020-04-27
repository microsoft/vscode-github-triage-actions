"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core = require("@actions/core");
const fs_1 = require("fs");
const path_1 = require("path");
const github_1 = require("@actions/github");
const octokit_1 = require("../../api/octokit");
const utils_1 = require("../../utils/utils");
const token = utils_1.getRequiredInput('token');
const allowLabels = utils_1.getRequiredInput('allowLabels').split('|');
const main = async () => {
    const github = new octokit_1.OctoKit(token, github_1.context.repo);
    const config = await github.readConfig(utils_1.getRequiredInput('config-path'));
    const labelings = JSON.parse(fs_1.readFileSync(path_1.join(__dirname, '../issue_labels.json'), { encoding: 'utf8' }));
    for (const labeling of labelings) {
        const label = labeling.labels.length === 1 ? labeling.labels[0] : undefined;
        const issue = new octokit_1.OctoKitIssue(token, github_1.context.repo, { number: labeling.number });
        const issueData = await issue.getIssue();
        if (!label ||
            issueData.assignee ||
            issueData.numComments ||
            issueData.labels.some((label) => !allowLabels.includes(label))) {
            continue;
        }
        const labelConfig = config[label];
        await Promise.all([
            (labelConfig === null || labelConfig === void 0 ? void 0 : labelConfig.skipLabeling) ? Promise.resolve() : issue.addLabel(label),
            (labelConfig === null || labelConfig === void 0 ? void 0 : labelConfig.comment) ? issue.postComment(labelConfig.comment) : Promise.resolve(),
            ...((labelConfig === null || labelConfig === void 0 ? void 0 : labelConfig.assign) ? labelConfig.assign.map((assignee) => issue.addAssignee(assignee)) : []),
        ]);
    }
};
main()
    .then(() => utils_1.logRateLimit(token))
    .catch(async (error) => {
    core.setFailed(error.message);
    await utils_1.logErrorToIssue(error.message, true, token);
});
//# sourceMappingURL=index.js.map