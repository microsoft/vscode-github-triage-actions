"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../common/utils");
const telemetry_1 = require("../common/telemetry");
class AuthorVerifiedQueryer {
    constructor(github, comment, pendingReleaseLabel, authorVerificationRequestedLabel, verifiedLabel) {
        this.github = github;
        this.comment = comment;
        this.pendingReleaseLabel = pendingReleaseLabel;
        this.authorVerificationRequestedLabel = authorVerificationRequestedLabel;
        this.verifiedLabel = verifiedLabel;
    }
    async run() {
        const query = `is:closed label:${this.pendingReleaseLabel} label:${this.authorVerificationRequestedLabel}`;
        for await (const page of this.github.query({ q: query })) {
            for (const issue of page) {
                const issueData = await issue.getIssue();
                if (issueData.labels.includes(this.pendingReleaseLabel) &&
                    issueData.labels.includes(this.authorVerificationRequestedLabel) &&
                    issueData.open === false) {
                    await new AuthorVerifiedLabeler(issue, this.comment, this.pendingReleaseLabel, this.authorVerificationRequestedLabel, this.verifiedLabel).run();
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }
                else {
                    console.log('Query returned an invalid issue:' +
                        JSON.stringify({ ...issueData, body: 'stripped' }));
                }
            }
        }
    }
}
exports.AuthorVerifiedQueryer = AuthorVerifiedQueryer;
class AuthorVerifiedLabeler {
    constructor(github, comment, pendingReleaseLabel, authorVerificationRequestedLabel, verifiedLabel) {
        this.github = github;
        this.comment = comment;
        this.pendingReleaseLabel = pendingReleaseLabel;
        this.authorVerificationRequestedLabel = authorVerificationRequestedLabel;
        this.verifiedLabel = verifiedLabel;
    }
    async run() {
        var _a;
        const issue = await this.github.getIssue();
        if (issue.open) {
            return;
        }
        const comment = async (comment) => {
            if (!issue.labels.includes(this.verifiedLabel)) {
                await this.github.postComment(comment);
            }
        };
        if (issue.labels.includes(this.authorVerificationRequestedLabel)) {
            const latestRelease = await utils_1.loadLatestRelease('insider');
            if (!latestRelease)
                throw Error('Error loading latest release');
            const closingInfo = (_a = (await this.github.getClosingInfo())) === null || _a === void 0 ? void 0 : _a.hash;
            if (!closingInfo) {
                await this.github.removeLabel(this.authorVerificationRequestedLabel);
                await comment(`<!-- UNABLE_TO_LOCATE_COMMIT_MESSAGE -->
Unable to locate closing commit in issue timeline. You can manually reference a commit by commenting \`\\closedWith someCommitSha\`.`);
                return;
            }
            let releaseContainsCommit = await this.github.releaseContainsCommit(latestRelease.version, closingInfo);
            if (releaseContainsCommit == 'yes') {
                await telemetry_1.trackEvent(this.github, 'author-verified:verifiable');
                await this.github.removeLabel(this.pendingReleaseLabel);
                await comment(this.comment
                    .replace('${commit}', latestRelease.version)
                    .replace('${author}', issue.author.name));
            }
            else if (releaseContainsCommit === 'no') {
                await this.github.addLabel(this.pendingReleaseLabel);
            }
            else {
                await this.github.removeLabel(this.pendingReleaseLabel);
                await comment(`<!-- UNABLE_TO_LOCATE_COMMIT_MESSAGE -->
	Issue marked as unreleased but unable to locate closing commit in repo history. You can manually reference a commit by commenting \`\\closedWith someCommitSha\`, then add back the \`${this.pendingReleaseLabel}\` label.`);
            }
        }
    }
}
exports.AuthorVerifiedLabeler = AuthorVerifiedLabeler;
//# sourceMappingURL=AuthorVerified.js.map