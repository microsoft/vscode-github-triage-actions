"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestPlanItemValidator = void 0;
const rest_1 = require("@octokit/rest");
const utils_1 = require("../common/utils");
const validator_1 = require("./validator");
const commentTag = '<!-- INVALID TEST PLAN ITEM -->';
class TestPlanItemValidator {
    constructor(github, token, refLabel, label, invalidLabel, comment) {
        this.github = github;
        this.token = token;
        this.refLabel = refLabel;
        this.label = label;
        this.invalidLabel = invalidLabel;
        this.comment = comment;
    }
    async run() {
        const issue = await this.github.getIssue();
        const shouldAddErrors = issue.labels.includes(this.label) || issue.labels.includes(this.invalidLabel);
        const madeByTeamMember = await this.github.hasWriteAccess(issue.author);
        if (!madeByTeamMember) {
            (0, utils_1.safeLog)('Issue not made by team member, skipping validation');
            return;
        }
        const tasks = [];
        let priorComments = undefined;
        for await (const page of this.github.getComments()) {
            priorComments = page.filter((comment) => comment.body.indexOf(commentTag) !== -1);
            if (priorComments) {
                (0, utils_1.safeLog)('Found prior comment. Deleting.');
                tasks.push(...priorComments.map((comment) => this.github.deleteComment(comment.id)));
            }
            break;
        }
        const errors = await this.getErrors(issue);
        if (errors && shouldAddErrors) {
            tasks.push(this.github.postComment(`${commentTag}\n${this.comment}\n\n**Error:** ${errors}`));
            tasks.push(this.github.addLabel(this.invalidLabel));
            tasks.push(this.github.removeLabel(this.label));
        }
        else {
            (0, utils_1.safeLog)('Valid testplan item found!');
            tasks.push(this.github.removeLabel(this.invalidLabel));
            tasks.push(this.github.addLabel(this.label));
        }
        await Promise.all(tasks);
    }
    async getErrors(issue) {
        try {
            const testPlan = (0, validator_1.parseTestPlanItem)(issue.body, issue.author.name);
            if (testPlan.issueRefs.length) {
                // In the case of testing we don't test this due to the complexity of the API.
                if (!this.token) {
                    return;
                }
                const octokit = new rest_1.Octokit({ auth: this.token });
                for (const referencedIssueNum of testPlan.issueRefs) {
                    await octokit.issues.addLabels({
                        owner: this.github.repoOwner,
                        repo: this.github.repoName,
                        issue_number: referencedIssueNum,
                        labels: [this.refLabel],
                    });
                }
            }
            return;
        }
        catch (error) {
            const err = error;
            return err.message;
        }
    }
}
exports.TestPlanItemValidator = TestPlanItemValidator;
//# sourceMappingURL=TestPlanitemValidator.js.map