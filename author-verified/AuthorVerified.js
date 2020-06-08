"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../utils/utils");
class AuthorVerifiedQueryer {
    constructor(github, comment, pendingReleaseLabel, authorVerificationRequestedLabel) {
        this.github = github;
        this.comment = comment;
        this.pendingReleaseLabel = pendingReleaseLabel;
        this.authorVerificationRequestedLabel = authorVerificationRequestedLabel;
    }
    async run() {
        const query = `is:closed label:${this.pendingReleaseLabel} label:${this.authorVerificationRequestedLabel}`;
        for await (const page of this.github.query({ q: query })) {
            for (const issue of page) {
                const issueData = await issue.getIssue();
                if (issueData.labels.includes(this.pendingReleaseLabel) &&
                    issueData.labels.includes(this.authorVerificationRequestedLabel) &&
                    issueData.open === false) {
                    await new AuthorVerifiedLabeler(issue, this.comment, this.pendingReleaseLabel, this.authorVerificationRequestedLabel).run();
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
    constructor(github, comment, pendingReleaseLabel, authorVerificationRequestedLabel) {
        this.github = github;
        this.comment = comment;
        this.pendingReleaseLabel = pendingReleaseLabel;
        this.authorVerificationRequestedLabel = authorVerificationRequestedLabel;
    }
    async run() {
        var _a;
        const issue = await this.github.getIssue();
        if (issue.open) {
            return;
        }
        if (issue.labels.find((label) => label === this.authorVerificationRequestedLabel)) {
            const latestRelease = await utils_1.loadLatestRelease('insider');
            if (!latestRelease)
                throw Error('Error loading latest release');
            const closingInfo = (_a = (await this.github.getClosingInfo())) === null || _a === void 0 ? void 0 : _a.hash;
            if (!closingInfo) {
                await this.github.removeLabel(this.authorVerificationRequestedLabel);
                await this.github.postComment(`<!-- UNABLE_TO_LOCATE_COMMIT_MESSAGE -->
Unable to locate closing commit in issue timeline. You can manually reference a commit by commenting \`\\closedWith someCommitSha\`.`);
                return;
            }
            let releaseContainsCommit = await this.github.releaseContainsCommit(latestRelease.version, closingInfo);
            if (releaseContainsCommit == 'yes') {
                await this.github.removeLabel(this.pendingReleaseLabel);
                await this.github.postComment(this.comment
                    .replace('${commit}', latestRelease.version)
                    .replace('${author}', issue.author.name));
            }
            else if (releaseContainsCommit === 'no') {
                await this.github.addLabel(this.pendingReleaseLabel);
            }
            else {
                await this.github.removeLabel(this.pendingReleaseLabel);
                await this.github.postComment(`<!-- UNABLE_TO_LOCATE_COMMIT_MESSAGE -->
	Issue marked as unreleased but unable to locate closing commit in repo history. You can manually reference a commit by commenting \`\\closedWith someCommitSha\`, then add back the \`${this.pendingReleaseLabel}\` label.`);
            }
        }
    }
}
exports.AuthorVerifiedLabeler = AuthorVerifiedLabeler;
//# sourceMappingURL=AuthorVerified.js.map