"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../utils/utils");
const EnglishPlease_1 = require("./EnglishPlease");
const octokit_1 = require("../api/octokit");
const core = require("@actions/core");
const github_1 = require("@actions/github");
const token = utils_1.getRequiredInput('token');
const nonEnglishLabel = utils_1.getRequiredInput('nonEnglishLabel');
const needsMoreInfoLabel = utils_1.getRequiredInput('needsMoreInfoLabel');
const translatorRequestedLabelPrefix = utils_1.getRequiredInput('translatorRequestedLabelPrefix');
const translatorRequestedLabelColor = utils_1.getRequiredInput('translatorRequestedLabelColor');
const cognitiveServicesAPIKey = utils_1.getRequiredInput('cognitiveServicesAPIKey');
const main = async () => {
    var _a;
    const issue = new octokit_1.OctoKitIssue(token, github_1.context.repo, { number: github_1.context.issue.number });
    // uses rough heuristics to check if issue is in foreign language
    const englishPleaseLabler = new EnglishPlease_1.EnglishPleaseLabler(issue, nonEnglishLabel);
    // uses azure cognitive services text translator api to detect specific language and post comment in that language
    const languageSpecificLabeler = new EnglishPlease_1.LanguageSpecificLabeler(issue, translatorRequestedLabelPrefix, translatorRequestedLabelColor, nonEnglishLabel, needsMoreInfoLabel, cognitiveServicesAPIKey);
    if (github_1.context.payload.action === 'opened') {
        await englishPleaseLabler.run();
        const issueData = await issue.getIssue();
        console.log('got new issue data', JSON.stringify(issueData, null, 2));
        if (issueData.labels.includes(nonEnglishLabel)) {
            await languageSpecificLabeler.run();
        }
    }
    else if (github_1.context.payload.action === 'edited' || ((_a = github_1.context.payload.label) === null || _a === void 0 ? void 0 : _a.name) === nonEnglishLabel) {
        await languageSpecificLabeler.run();
    }
};
main()
    .then(() => utils_1.logRateLimit(token))
    .catch(async (error) => {
    core.setFailed(error.message);
    await utils_1.logErrorToIssue(error.message, true, token);
});
//# sourceMappingURL=index.js.map