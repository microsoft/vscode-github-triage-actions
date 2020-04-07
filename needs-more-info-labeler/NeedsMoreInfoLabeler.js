"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
class NeedsMoreInfoLabeler {
    constructor(github, label, comment, matcher, tag, bots, flagTeam = false) {
        this.github = github;
        this.label = label;
        this.comment = comment;
        this.matcher = matcher;
        this.tag = tag;
        this.bots = bots;
        this.flagTeam = flagTeam;
    }
    async run() {
        var _a;
        const issue = await this.github.getIssue();
        if ((await this.github.hasWriteAccess(issue.author)) && !this.flagTeam) {
            return;
        }
        const stripped = issue.body.replace(/<!--.*?-->/g, '');
        if (!(new RegExp(this.matcher, 'i').test(stripped) ||
            new RegExp(this.matcher, 'i').test(issue.title) ||
            (this.tag && issue.body.indexOf(this.tag) !== -1))) {
            if (!issue.labels.includes(this.label)) {
                console.log('Needs more info');
                await Promise.all([this.github.addLabel(this.label), this.github.postComment(this.comment)]);
            }
        }
        else if (issue.labels.includes(this.label)) {
            console.log('No longer needs more info');
            const itereator = this.github.getComments();
            const firstPage = await itereator.next();
            if (firstPage.done)
                return;
            const tasks = [];
            const commentID = (_a = firstPage.value.filter((comment) => comment.body === this.comment)[0]) === null || _a === void 0 ? void 0 : _a.id;
            if (commentID) {
                console.log('Deleting prior comment');
                tasks.push(this.github.deleteComment(firstPage.value[0].id));
                const otherCommeters = firstPage.value.filter((comment) => this.bots.indexOf(comment.author.name) === -1);
                if (otherCommeters.length === 0) {
                    console.log('Deleting label');
                    tasks.push(this.github.removeLabel(this.label));
                }
                else {
                    console.log('Not deleting label. Commented on by ' + otherCommeters.join(','));
                }
            }
            await Promise.all(tasks);
        }
    }
}
exports.NeedsMoreInfoLabeler = NeedsMoreInfoLabeler;
