"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthorVerifiedLabeler = void 0;
const utils_1 = require("../common/utils");
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
        if (!issue)
            return;
        if (!issue.open &&
            issue.labels.includes(this.authorVerificationRequestedLabel) &&
            issue.labels.includes(this.releasedLabel)) {
            const latestRelease = await (0, utils_1.loadLatestRelease)('insider');
            if (!latestRelease)
                throw Error('Error loading latest release');
            if (!issue.labels.includes(this.verifiedLabel)) {
                if (issue.locked) {
                    await this.github.unlockIssue();
                }
                await this.commentVerficationRequest(this.comment
                    .replace('${commit}', latestRelease.version)
                    .replace('${author}', issue.author.name));
            }
        }
    }
}
exports.AuthorVerifiedLabeler = AuthorVerifiedLabeler;
//# sourceMappingURL=AuthorVerified.js.map