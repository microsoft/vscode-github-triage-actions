"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.unenrollIssue = exports.enrollIssue = exports.ReleasePipeline = void 0;
const utils_1 = require("../common/utils");
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
                if (!issueData)
                    continue;
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
    async commentUnableToFindCommitMessage(issue) {
        const key = `<!-- UNABLE_TO_LOCATE_COMMIT_MESSAGE -->`;
        for await (const page of issue.getComments()) {
            for (const comment of page) {
                if (comment.body.includes(key)) {
                    return;
                }
            }
        }
        await issue.postComment(`${key}\nIssue marked as unreleased but unable to locate closing commit in issue timeline. You can manually reference a commit by commenting \`\\closedWith someCommitSha\`, or directly add the \`${this.insidersReleasedLabel}\` label if you know this has already been released`);
    }
    async update(issue, latestRelease) {
        var _a;
        const closingHash = (_a = (await issue.getClosingInfo())) === null || _a === void 0 ? void 0 : _a.hash;
        if (!closingHash) {
            await issue.removeLabel(this.notYetReleasedLabel);
            await this.commentUnableToFindCommitMessage(issue);
            return;
        }
        const releaseContainsCommit = await issue
            .releaseContainsCommit(latestRelease.version, closingHash)
            .catch(() => 'unknown');
        if (releaseContainsCommit === 'yes') {
            await issue.removeLabel(this.notYetReleasedLabel);
            await issue.addLabel(this.insidersReleasedLabel);
        }
        else if (releaseContainsCommit === 'no') {
            await issue.removeLabel(this.insidersReleasedLabel);
            await issue.addLabel(this.notYetReleasedLabel);
        }
        else {
            const ghIssue = await issue.getIssue();
            if (ghIssue && ghIssue.labels.includes(this.notYetReleasedLabel)) {
                await issue.removeLabel(this.notYetReleasedLabel);
                await this.commentUnableToFindCommitMessage(issue);
            }
        }
    }
}
exports.ReleasePipeline = ReleasePipeline;
const enrollIssue = async (issue, notYetReleasedLabel) => {
    var _a, _b;
    const closingHash = (_a = (await issue.getClosingInfo())) === null || _a === void 0 ? void 0 : _a.hash;
    if (closingHash) {
        await issue.addLabel(notYetReleasedLabel);
        // Get the milestone linked to the current release and set it if the issue doesn't have one
        const releaseMilestone = ((_b = (await issue.getIssue())) === null || _b === void 0 ? void 0 : _b.milestone)
            ? undefined
            : await issue.getCurrentRepoMilestone();
        if (releaseMilestone !== undefined) {
            await issue.setMilestone(releaseMilestone);
        }
    }
};
exports.enrollIssue = enrollIssue;
const unenrollIssue = async (issue, notYetReleasedLabel, insidersReleasedLabel) => {
    await issue.removeLabel(insidersReleasedLabel);
    await issue.removeLabel(notYetReleasedLabel);
};
exports.unenrollIssue = unenrollIssue;
//# sourceMappingURL=ReleasePipeline.js.map