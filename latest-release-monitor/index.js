"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core = require("@actions/core");
const github_1 = require("@actions/github");
const utils_1 = require("../utils/utils");
const blobStorage_1 = require("../classifier/blobStorage");
const octokit_1 = require("../api/octokit");
const token = utils_1.getRequiredInput('token');
const storageKey = utils_1.getRequiredInput('storageKey');
const update = async (quality) => {
    var _a;
    let lastKnown = undefined;
    try {
        lastKnown = await blobStorage_1.downloadBlobText('latest-' + quality, 'latest-releases', storageKey);
    }
    catch {
        // pass
    }
    const latest = (_a = (await utils_1.loadLatestRelease(quality))) === null || _a === void 0 ? void 0 : _a.version;
    if (latest && latest !== lastKnown) {
        console.log('found a new release of', quality);
        await blobStorage_1.uploadBlobText('latest-' + quality, latest, 'latest-releases', storageKey);
        await new octokit_1.OctoKit(token, github_1.context.repo).dispatch('released-' + quality);
    }
};
const main = async () => {
    await update('insider');
    await update('stable');
};
main()
    .then(() => utils_1.logRateLimit(token))
    .catch(async (error) => {
    core.setFailed(error.message);
    await utils_1.logErrorToIssue(error, true, token);
});
//# sourceMappingURL=index.js.map