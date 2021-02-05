"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../common/utils");
const telemetry_1 = require("../common/telemetry");
class AuthorVerifiedQueryer {
    constructor(github, comment, releasedLabel, authorVerificationRequestedLabel, verifiedLabel) {
        this.github = github;
        this.comment = comment;
        this.releasedLabel = releasedLabel;
        this.authorVerificationRequestedLabel = authorVerificationRequestedLabel;
        this.verifiedLabel = verifiedLabel;
    }
    async run() {
        const query = `is:closed label:${this.releasedLabel} label:${this.authorVerificationRequestedLabel} -label:${this.verifiedLabel}`;
        for await (const page of this.github.query({ q: query })) {
            for (const issue of page) {
                const issueData = await issue.getIssue();
                if (issueData.labels.includes(this.releasedLabel) &&
                    issueData.labels.includes(this.authorVerificationRequestedLabel) &&
                    !issueData.labels.includes(this.verifiedLabel) &&
                    issueData.open === false) {
                    await new AuthorVerifiedLabeler(issue, this.comment, this.releasedLabel, this.authorVerificationRequestedLabel, this.verifiedLabel).run();
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                }
                else {
                    utils_1.safeLog('Query returned an invalid issue:' + issueData.number);
                }
            }
        }
    }
}
exports.AuthorVerifiedQueryer = AuthorVerifiedQueryer;
class AuthorVerifiedLabeler {
    constructor(github, comment, releasedLabel, authorVerificationRequestedLabel, verifiedLabel) {
        this.github = github;
        this.comment = comment;
        this.releasedLabel = releasedLabel;
        this.authorVerificationRequestedLabel = authorVerificationRequestedLabel;
        this.verifiedLabel = verifiedLabel;
    }
    async commentVerficationRequest(comment) {
        const key = `<!-- AUTHOR_VERIFICATION_REQUEST -->`;
        for await (const page of this.github.getComments()) {
            for (const comment of page) {
                if (comment.body.includes(key) ||
                    comment.body.includes('you can help us out by commenting `/verified`') // legacy
                ) {
                    return;
                }
            }
        }
        await this.github.postComment(`${key}\n${comment}`);
    }
    async run() {
        const issue = await this.github.getIssue();
        if (issue.open) {
            return;
        }
        if (issue.labels.includes(this.authorVerificationRequestedLabel) &&
            issue.labels.includes(this.releasedLabel)) {
            const latestRelease = await utils_1.loadLatestRelease('insider');
            if (!latestRelease)
                throw Error('Error loading latest release');
            await telemetry_1.trackEvent(this.github, 'author-verified:verifiable');
            if (!issue.labels.includes(this.verifiedLabel)) {
                await this.commentVerficationRequest(this.comment
                    .replace('${commit}', latestRelease.version)
                    .replace('${author}', issue.author.name));
            }
        }
    }
}
exports.AuthorVerifiedLabeler = AuthorVerifiedLabeler;
//# sourceMappingURL=AuthorVerified.js.map