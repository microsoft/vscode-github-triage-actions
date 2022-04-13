"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.unenrollIssue = exports.enrollIssue = exports.ReleasePipeline = void 0;
const utils_1 = require("../common/utils");
const telemetry_1 = require("../common/telemetry");
class ReleasePipeline {
    constructor(github, notYetReleasedLabel, insidersReleasedLabel) {
        this.github = github;
        this.notYetReleasedLabel = notYetReleasedLabel;
        this.insidersReleasedLabel = insidersReleasedLabel;
    }
    async run() {
        const latestRelease = await (0, utils_1.loadLatestRelease)('insider');
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
                    (0, utils_1.safeLog)('Query returned an invalid issue:' + issueData.number);
                }
            }
        }
    }
    async commentUnableToFindCommitMessage(issue, location) {
        const key = `<!-- UNABLE_TO_LOCATE_COMMIT_MESSAGE ${location} -->`;
        for await (const page of issue.getComments()) {
            for (const comment of page) {
                if (comment.body.includes(key)) {
                    return;
                }
            }
        }
        if (location === 'repo') {
            await issue.postComment(`${key}
Issue marked as unreleased but unable to locate closing commit in repo history. If this was closed in a separate repo you can add the \`${this.insidersReleasedLabel}\` label directly, or comment \`\\closedWith someShaThatWillbeReleasedWhenThisIsRelesed\`.`);
        }
        else {
            await issue.postComment(`${key}
Issue marked as unreleased but unable to locate closing commit in issue timeline. You can manually reference a commit by commenting \`\\closedWith someCommitSha\`, or directly add the \`${this.insidersReleasedLabel}\` label if you know this has already been releaased`);
        }
    }
    async update(issue, latestRelease) {
        var _a;
        const closingHash = (_a = (await issue.getClosingInfo())) === null || _a === void 0 ? void 0 : _a.hash;
        if (!closingHash) {
            await issue.removeLabel(this.notYetReleasedLabel);
            await this.commentUnableToFindCommitMessage(issue, 'issue');
            return;
        }
        const releaseContainsCommit = await issue
            .releaseContainsCommit(latestRelease.version, closingHash)
            .catch(() => 'unknown');
        if (releaseContainsCommit === 'yes') {
            await (0, telemetry_1.trackEvent)(issue, 'insiders-released:released');
            await issue.removeLabel(this.notYetReleasedLabel);
            await issue.addLabel(this.insidersReleasedLabel);
        }
        else if (releaseContainsCommit === 'no') {
            await issue.removeLabel(this.insidersReleasedLabel);
            await issue.addLabel(this.notYetReleasedLabel);
        }
        else if ((await issue.getIssue()).labels.includes(this.notYetReleasedLabel)) {
            await issue.removeLabel(this.notYetReleasedLabel);
            await this.commentUnableToFindCommitMessage(issue, 'repo');
        }
    }
}
exports.ReleasePipeline = ReleasePipeline;
const enrollIssue = async (issue, notYetReleasedLabel) => {
    var _a;
    const closingHash = (_a = (await issue.getClosingInfo())) === null || _a === void 0 ? void 0 : _a.hash;
    if (closingHash) {
        await issue.addLabel(notYetReleasedLabel);
        await (0, telemetry_1.trackEvent)(issue, 'insiders-released:unreleased');
    }
    else {
        await (0, telemetry_1.trackEvent)(issue, 'insiders-released:skipped');
    }
};
exports.enrollIssue = enrollIssue;
const unenrollIssue = async (issue, notYetReleasedLabel, insidersReleasedLabel) => {
    await issue.removeLabel(insidersReleasedLabel);
    await issue.removeLabel(notYetReleasedLabel);
};
exports.unenrollIssue = unenrollIssue;
//# sourceMappingURL=ReleasePipeline.js.map