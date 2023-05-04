"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const github_1 = require("@actions/github");
const Action_1 = require("../common/Action");
const utils_1 = require("../common/utils");
class TriageInfoNeeded extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'TriageInfoNeeded';
    }
    async onCommented(octoKitIssue) {
        const action = (0, utils_1.getRequiredInput)('action');
        const github = octoKitIssue.octokit;
        if (action === 'add') {
            await this.addLabel(github);
        }
        else {
            await this.removeLabel(github);
        }
    }
    async addLabel(github) {
        const issue = await github.rest.issues.get({
            owner: github_1.context.repo.owner,
            repo: github_1.context.repo.repo,
            issue_number: github_1.context.issue.number,
        });
        const commentAuthor = github_1.context.payload.comment.user.login;
        const commentBody = github_1.context.payload.comment.body;
        const isTeamMember = JSON.parse((0, utils_1.getRequiredInput)('triagers')).includes(commentAuthor);
        const keywords = JSON.parse((0, utils_1.getRequiredInput)('keywords'));
        const isRequestForInfo = new RegExp(keywords.join('|'), 'i').test(commentBody);
        const shouldAddLabel = isTeamMember && commentAuthor !== issue.data.user.login && isRequestForInfo;
        if (shouldAddLabel) {
            await github.rest.issues.addLabels({
                owner: github_1.context.repo.owner,
                repo: github_1.context.repo.repo,
                issue_number: github_1.context.issue.number,
                labels: ['info-needed'],
            });
        }
    }
    async removeLabel(github) {
        const issue = await github.rest.issues.get({
            owner: github_1.context.repo.owner,
            repo: github_1.context.repo.repo,
            issue_number: github_1.context.issue.number,
        });
        const commentAuthor = github_1.context.payload.comment.user.login;
        const issueAuthor = issue.data.user.login;
        if (commentAuthor === issueAuthor) {
            await github.rest.issues.removeLabel({
                owner: github_1.context.repo.owner,
                repo: github_1.context.repo.repo,
                issue_number: github_1.context.issue.number,
                name: 'info-needed',
            });
            return;
        }
        if (JSON.parse((0, utils_1.getRequiredInput)('triagers')).includes(commentAuthor)) {
            // If one of triagers made a comment, ignore it
            return;
        }
        // Loop through all the comments on the issue in reverse order and find the last username that a TRIAGER mentioned
        // If the comment author is the last mentioned username, remove the "info-needed" label
        const comments = await github.rest.issues.listComments({
            owner: github_1.context.repo.owner,
            repo: github_1.context.repo.repo,
            issue_number: github_1.context.issue.number,
        });
        for (const comment of comments.data.slice().reverse()) {
            if (!JSON.parse((0, utils_1.getRequiredInput)('triagers')).includes(comment.user.login)) {
                continue;
            }
            const matches = comment.body.match(/@\w+/g) || [];
            const mentionedUsernames = matches.map((match) => match.replace('@', ''));
            if (mentionedUsernames.includes(commentAuthor)) {
                await github.rest.issues.removeLabel({
                    owner: github_1.context.repo.owner,
                    repo: github_1.context.repo.repo,
                    issue_number: github_1.context.issue.number,
                    name: 'info-needed',
                });
                break;
            }
        }
    }
}
new TriageInfoNeeded().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map