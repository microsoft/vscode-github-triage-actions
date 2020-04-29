"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core = require("@actions/core");
const github_1 = require("@actions/github");
const octokit_1 = require("../api/octokit");
const utils_1 = require("../utils/utils");
const NewRelease_1 = require("./NewRelease");
const token = utils_1.getRequiredInput('token');
const main = async () => {
    await new NewRelease_1.NewRelease(new octokit_1.OctoKitIssue(token, github_1.context.repo, { number: github_1.context.issue.number }), utils_1.getRequiredInput('label'), utils_1.getRequiredInput('labelColor'), utils_1.getRequiredInput('labelDescription'), +utils_1.getRequiredInput('days')).run();
};
main()
    .then(() => utils_1.logRateLimit(token))
    .catch(async (error) => {
    core.setFailed(error.message);
    await utils_1.logErrorToIssue(error, true, token);
});
//# sourceMappingURL=index.js.map