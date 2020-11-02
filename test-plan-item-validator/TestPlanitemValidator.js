"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const validator_1 = require("./validator");
const commentTag = '<!-- INVALID TEST PLAN ITEM -->';
class TestPlanItemValidator {
    constructor(github, label, invalidLabel, comment) {
        this.github = github;
        this.label = label;
        this.invalidLabel = invalidLabel;
        this.comment = comment;
    }
    async run() {
        const issue = await this.github.getIssue();
        if (!(issue.labels.includes(this.label) || issue.labels.includes(this.invalidLabel))) {
            console.log(`Labels ${this.label}/${this.invalidLabel} not in issue labels ${issue.labels.join(',')}. Aborting.`);
            return;
        }
        const tasks = [];
        let priorComments = undefined;
        for await (const page of this.github.getComments()) {
            priorComments = page.filter((comment) => comment.body.indexOf(commentTag) !== -1);
            if (priorComments) {
                console.log('Found prior comment. Deleting.');
                tasks.push(...priorComments.map((comment) => this.github.deleteComment(comment.id)));
            }
            break;
        }
        const errors = this.getErrors(issue);
        if (errors) {
            tasks.push(this.github.postComment(`${commentTag}\n${this.comment}\n\n**Error:** ${errors}`));
            tasks.push(this.github.addLabel(this.invalidLabel));
            tasks.push(this.github.removeLabel(this.label));
        }
        else {
            console.log('All good!');
            tasks.push(this.github.removeLabel(this.invalidLabel));
            tasks.push(this.github.addLabel(this.label));
        }
        await Promise.all(tasks);
    }
    getErrors(issue) {
        try {
            validator_1.parseTestPlanItem(issue.body, issue.author.name);
            return;
        }
        catch (error) {
            return error.message;
        }
    }
}
exports.TestPlanItemValidator = TestPlanItemValidator;
//# sourceMappingURL=TestPlanitemValidator.js.map