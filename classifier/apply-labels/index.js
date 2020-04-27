"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core = require("@actions/core");
const fs_1 = require("fs");
const path_1 = require("path");
const github_1 = require("@actions/github");
const octokit_1 = require("../../api/octokit");
const utils_1 = require("../../utils/utils");
const token = utils_1.getRequiredInput('token');
const main = async () => {
    const _github = new octokit_1.OctoKit(token, github_1.context.repo);
    const file = JSON.parse(fs_1.readFileSync(path_1.join(__dirname, '../issue_labels.json'), { encoding: 'utf8' }));
    console.log('Got labelings', JSON.stringify(file, null, 2));
};
main()
    .then(() => utils_1.logRateLimit(token))
    .catch(async (error) => {
    core.setFailed(error.message);
    await utils_1.logErrorToIssue(error.message, true, token);
});
//# sourceMappingURL=index.js.map