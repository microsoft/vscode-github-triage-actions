"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureRequestOnMilestone = exports.FeatureRequestOnLabel = exports.ACCEPT_MARKER = exports.REJECT_MARKER = exports.WARN_MARKER = exports.CREATE_MARKER = void 0;
exports.CREATE_MARKER = '<!-- 6d457af9-96bd-47a8-a0e8-ecf120dfffc1 -->'; // do not change, this is how we find the comments the bot made when assigning the issue was assigned to the candidate milestone
exports.WARN_MARKER = '<!-- 7e568b0a-a7ce-58b9-b1f9-fd0231e000d2 -->'; // do not change, this is how we find the comments the bot made when writing a warning message
exports.REJECT_MARKER = '<!-- 8f679c1b-b8df-69ca-c20a-0e1342f111e3 -->'; // do not change, this is how we find the comments the bot made when rejecting an issue
exports.ACCEPT_MARKER = '<!-- 9078ab2c-c9e0-7adb-d31b-1f23430222f4 -->'; // do not change, this is how we find the comments the bot made when accepting an issue
class FeatureRequestOnLabel {
    constructor(github, delay, milestone, label) {
        this.github = github;
        this.delay = delay;
        this.milestone = milestone;
        this.label = label;
    }
    async run() {
        var _a;
        await new Promise((resolve) => setTimeout(resolve, this.delay * 1000));
        const issue = await this.github.getIssue();
        if (!issue.open ||
            ((_a = issue.milestone) === null || _a === void 0 ? void 0 : _a.milestoneId) ||
            !issue.labels.includes(this.label) ||
            (await this.github.hasWriteAccess(issue.author.name))) {
            return;
        }
        return this.github.setMilestone(this.milestone);
    }
}
exports.FeatureRequestOnLabel = FeatureRequestOnLabel;
class FeatureRequestOnMilestone {
    constructor(github, comment, milestone) {
        this.github = github;
        this.comment = comment;
        this.milestone = milestone;
    }
    async run() {
        var _a;
        const issue = await this.github.getIssue();
        if (issue.open && ((_a = issue.milestone) === null || _a === void 0 ? void 0 : _a.milestoneId) === this.milestone) {
            await this.github.postComment(exports.CREATE_MARKER + '\n' + this.comment);
        }
    }
}
exports.FeatureRequestOnMilestone = FeatureRequestOnMilestone;
//# sourceMappingURL=FeatureRequest.js.map