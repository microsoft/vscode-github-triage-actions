"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
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
        const updatedTimestamp = utils_1.daysAgoToHumanReadbleDate(this.closeDays);
        const pingTimestamp = utils_1.daysAgoToTimestamp(this.pingDays);
        const query = `updated:<${updatedTimestamp} label:"${this.label}" is:open is:unlocked`;
        for await (const page of this.github.query({ q: query })) {
            for (const issue of page) {
                const hydrated = await issue.getIssue();
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
                        (await issue.hasWriteAccess(lastComment.author))) {
                        if (lastComment) {
                            utils_1.safeLog(`Last comment on ${hydrated.number} by team. Closing.`);
                        }
                        else {
                            utils_1.safeLog(`No comments on ${hydrated.number}. Closing.`);
                        }
                        if (this.closeComment) {
                            await issue.postComment(this.closeComment);
                        }
                        await issue.closeIssue();
                    }
                    else {
                        if (hydrated.updatedAt < pingTimestamp && hydrated.assignee) {
                            utils_1.safeLog(`Last comment on ${hydrated.number} by rando. Pinging @${hydrated.assignee}`);
                            if (this.pingComment) {
                                await issue.postComment(this.pingComment
                                    .replace('${assignee}', hydrated.assignee)
                                    .replace('${author}', hydrated.author.name));
                            }
                        }
                        else {
                            utils_1.safeLog(`Last comment on ${hydrated.number} by rando. Skipping.${hydrated.assignee ? ' cc @' + hydrated.assignee : ''}`);
                        }
                    }
                }
                else {
                    utils_1.safeLog('Query returned an invalid issue:' + hydrated.number);
                }
            }
        }
    }
}
exports.NeedsMoreInfoCloser = NeedsMoreInfoCloser;
//# sourceMappingURL=NeedsMoreInfoCloser.js.map