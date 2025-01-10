"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.NeedsMoreInfoCloser = void 0;
const utils_1 = require("../common/utils");
class NeedsMoreInfoCloser {
    constructor(github, label, closeDays, pingDays, closeComment, pingComment, additionalTeam) {
        this.github = github;
        this.label = label;
        this.closeDays = closeDays;
        this.pingDays = pingDays;
        this.closeComment = closeComment;
        this.pingComment = pingComment;
        this.additionalTeam = additionalTeam;
    }
    async run() {
        var _a;
        const updatedTimestamp = (0, utils_1.daysAgoToHumanReadbleDate)(this.closeDays);
        const pingTimestamp = (0, utils_1.daysAgoToTimestamp)(this.pingDays);
        const query = `repo:${this.github.repoOwner}/${this.github.repoName} updated:<${updatedTimestamp} label:"${this.label}" is:open is:unlocked`;
        for await (const page of this.github.query({ q: query })) {
            for (const issue of page) {
                const hydrated = await issue.getIssue();
                if (!hydrated)
                    continue;
                const lastCommentIterator = await issue.getComments(true).next();
                if (lastCommentIterator.done) {
                    throw Error('Unexpected comment data');
                }
                const lastComment = lastCommentIterator.value[0];
                if (hydrated.open &&
                    hydrated.labels.includes(this.label)
                // TODO: Verify updated timestamp
                ) {
                    if (!lastComment ||
                        lastComment.author.isGitHubApp ||
                        // TODO: List the collaborators once per go rather than checking a single user each issue
                        this.additionalTeam.includes(lastComment.author.name) ||
                        (await issue.hasWriteAccess(lastComment.author.name))) {
                        if (lastComment) {
                            (0, utils_1.safeLog)(`Last comment on ${hydrated.number} by team. Closing.`);
                        }
                        else {
                            (0, utils_1.safeLog)(`No comments on ${hydrated.number}. Closing.`);
                        }
                        if (this.closeComment) {
                            await issue.postComment(this.closeComment);
                        }
                        await issue.closeIssue('not_planned');
                    }
                    else {
                        if (hydrated.updatedAt < pingTimestamp && hydrated.assignee) {
                            (0, utils_1.safeLog)(`Last comment on ${hydrated.number} by rando. Pinging @${hydrated.assignee}`);
                            if (this.pingComment) {
                                await issue.postComment(this.pingComment
                                    .replace('${assignee}', ((_a = hydrated.assignees) === null || _a === void 0 ? void 0 : _a.join(' @')) || hydrated.assignee)
                                    .replace('${author}', hydrated.author.name));
                            }
                        }
                        else {
                            (0, utils_1.safeLog)(`Last comment on ${hydrated.number} by rando. Skipping.${hydrated.assignee ? ' cc @' + hydrated.assignee : ''}`);
                        }
                    }
                }
                else {
                    (0, utils_1.safeLog)('Query returned an invalid issue:' + hydrated.number);
                }
            }
        }
    }
}
exports.NeedsMoreInfoCloser = NeedsMoreInfoCloser;
//# sourceMappingURL=NeedsMoreInfoCloser.js.map