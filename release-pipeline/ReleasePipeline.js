"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../common/utils");
const Action_1 = require("../common/Action");
class ReleasePipeline {
    constructor(github, notYetReleasedLabel, insidersReleasedLabel) {
        this.github = github;
        this.notYetReleasedLabel = notYetReleasedLabel;
        this.insidersReleasedLabel = insidersReleasedLabel;
    }
    async run() {
        const latestRelease = await utils_1.loadLatestRelease('insider');
        if (!latestRelease)
            throw Error('Error loading latest release');
        const query = `is:closed label:${this.notYetReleasedLabel}`;
        for await (const page of this.github.query({ q: query })) {
            for (const issue of page) {
                const issueData = await issue.getIssue();
                if (issueData.labels.includes(this.notYetReleasedLabel) && issueData.open === false) {
                    await this.update(issue, latestRelease);
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }
                else {
                    console.log('Query returned an invalid issue:' +
                        JSON.stringify({ ...issueData, body: 'stripped' }));
                }
            }
        }
    }
    async update(issue, latestRelease) {
        var _a;
        const closingHash = (_a = (await issue.getClosingInfo())) === null || _a === void 0 ? void 0 : _a.hash;
        if (!closingHash) {
            await issue.removeLabel(this.notYetReleasedLabel);
            await issue.postComment(`<!-- UNABLE_TO_LOCATE_COMMIT_MESSAGE -->
Issue marked as unreleased but unable to locate closing commit in issue timeline. You can manually reference a commit by commenting \`\\closedWith someCommitSha\`, then add back the \`unreleased\` label.`);
            return;
        }
        let errorMessage = '';
        const releaseContainsCommit = await issue
            .releaseContainsCommit(latestRelease.version, closingHash)
            .catch(async (e) => {
            errorMessage = `\n\`\`\`${e.message}\`\`\``;
            return 'unknown';
        });
        if (releaseContainsCommit === 'yes') {
            await Action_1.trackEvent('insiders-released:released');
            await issue.removeLabel(this.notYetReleasedLabel);
            await issue.addLabel(this.insidersReleasedLabel);
        }
        else if (releaseContainsCommit === 'no') {
            await issue.removeLabel(this.insidersReleasedLabel);
            await issue.addLabel(this.notYetReleasedLabel);
        }
        else if ((await issue.getIssue()).labels.includes(this.notYetReleasedLabel)) {
            await issue.removeLabel(this.notYetReleasedLabel);
            await issue.postComment(`<!-- UNABLE_TO_LOCATE_COMMIT_MESSAGE -->
Issue marked as unreleased but unable to locate closing commit in repo history. You can manually reference a commit by commenting \`\\closedWith someCommitSha\`, then add back the \`unreleased\` label.` +
                errorMessage);
        }
    }
}
exports.ReleasePipeline = ReleasePipeline;
exports.enrollIssue = async (issue, notYetReleasedLabel) => {
    var _a;
    const closingHash = (_a = (await issue.getClosingInfo())) === null || _a === void 0 ? void 0 : _a.hash;
    if (closingHash) {
        await issue.addLabel(notYetReleasedLabel);
        await Action_1.trackEvent('insiders-released:unreleased');
    }
    else {
        await Action_1.trackEvent('insiders-released:skipped');
    }
};
exports.unenrollIssue = async (issue, notYetReleasedLabel, insidersReleasedLabel) => {
    await issue.removeLabel(insidersReleasedLabel);
    await issue.removeLabel(notYetReleasedLabel);
};
//# sourceMappingURL=ReleasePipeline.js.map