"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const github_1 = require("@actions/github");
const Action_1 = require("../common/Action");
const utils_1 = require("../common/utils");
class IssueLabels extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'IssueLabels';
    }
    async onReopened(octoKitIssue) {
        await this.checkLabels(octoKitIssue);
    }
    async onOpened(octoKitIssue) {
        await this.checkLabels(octoKitIssue);
    }
    async checkLabels(octoKitIssue) {
        const github = octoKitIssue.octokit;
        const result = await github.rest.issues.listLabelsOnIssue({
            owner: github_1.context.repo.owner,
            repo: github_1.context.repo.repo,
            issue_number: github_1.context.issue.number,
        });
        const labels = result.data.map((label) => label.name);
        const hasNeedsOrTPI = labels.some((label) => label.startsWith('needs') ||
            label === 'testplan-item' ||
            label.startsWith('iteration-plan') ||
            label === 'release-plan');
        if (!hasNeedsOrTPI) {
            console.log('This issue is not labeled with a "needs __", "iteration-plan", "release-plan", or the "testplan-item" label; add the "triage-needed" label.');
            github.rest.issues.addLabels({
                owner: github_1.context.repo.owner,
                repo: github_1.context.repo.repo,
                issue_number: github_1.context.issue.number,
                labels: ['triage-needed'],
            });
        }
        else {
            console.log('This issue already has a "needs __", "iteration-plan", "release-plan", or the "testplan-item" label, do not add the "triage-needed" label.');
        }
        const knownTriagers = JSON.parse((0, utils_1.getRequiredInput)('triagers'));
        const currentAssignees = await github.rest.issues
            .get({
            owner: github_1.context.repo.owner,
            repo: github_1.context.repo.repo,
            issue_number: github_1.context.issue.number,
        })
            .then((result) => result.data.assignees.map((a) => a.login));
        console.log('Known triagers:', JSON.stringify(knownTriagers));
        console.log('Current assignees:', JSON.stringify(currentAssignees));
        const assigneesToRemove = currentAssignees.filter((a) => !knownTriagers.includes(a));
        console.log('Assignees to remove:', JSON.stringify(assigneesToRemove));
        github.rest.issues.removeAssignees({
            owner: github_1.context.repo.owner,
            repo: github_1.context.repo.repo,
            issue_number: github_1.context.issue.number,
            assignees: assigneesToRemove,
        });
    }
}
new IssueLabels().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map