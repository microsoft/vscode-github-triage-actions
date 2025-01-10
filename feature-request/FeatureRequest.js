"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureRequestOnMilestone = exports.FeatureRequestOnLabel = exports.FeatureRequestQueryer = exports.ACCEPT_MARKER = exports.REJECT_MARKER = exports.WARN_MARKER = exports.CREATE_MARKER = void 0;
const utils_1 = require("../common/utils");
exports.CREATE_MARKER = '<!-- 6d457af9-96bd-47a8-a0e8-ecf120dfffc1 -->'; // do not change, this is how we find the comments the bot made when assigning the issue was assigned to the candidate milestone
exports.WARN_MARKER = '<!-- 7e568b0a-a7ce-58b9-b1f9-fd0231e000d2 -->'; // do not change, this is how we find the comments the bot made when writing a warning message
exports.REJECT_MARKER = '<!-- 8f679c1b-b8df-69ca-c20a-0e1342f111e3 -->'; // do not change, this is how we find the comments the bot made when rejecting an issue
exports.ACCEPT_MARKER = '<!-- 9078ab2c-c9e0-7adb-d31b-1f23430222f4 -->'; // do not change, this is how we find the comments the bot made when accepting an issue
class FeatureRequestQueryer {
    constructor(github, config) {
        this.github = github;
        this.config = config;
    }
    async run() {
        var _a;
        let query = `repo:${this.github.repoOwner}/${this.github.repoName} is:open is:issue milestone:"${this.config.milestones.candidateName}" label:"${this.config.featureRequestLabel}"`;
        query += this.config.labelsToExclude.map((l) => `-label:"${l}"`).join(' ');
        for await (const page of this.github.query({ q: query })) {
            for (const issue of page) {
                const issueData = await issue.getIssue();
                if (!issueData)
                    continue;
                if (issueData.open &&
                    ((_a = issueData.milestone) === null || _a === void 0 ? void 0 : _a.milestoneId) === this.config.milestones.candidateID &&
                    issueData.labels.includes(this.config.featureRequestLabel) &&
                    !issueData.labels.some((issueLabel) => this.config.labelsToExclude.some((excludeLabel) => issueLabel === excludeLabel))) {
                    await this.actOn(issue);
                }
                else {
                    (0, utils_1.safeLog)('Query returned an invalid issue:', issueData.number);
                }
            }
        }
    }
    async actOn(issue) {
        const issueData = await issue.getIssue();
        if (!issueData)
            return;
        if (!issueData.reactions)
            throw Error('No reaction data in issue ' + JSON.stringify(issueData));
        if (issueData.reactions['+1'] >= this.config.upvotesRequired &&
            this.config.comments.accept &&
            this.config.milestones.backlogID) {
            (0, utils_1.safeLog)(`Issue #${issueData.number} sucessfully promoted`);
            await Promise.all([
                issue.setMilestone(this.config.milestones.backlogID),
                issue.postComment(exports.ACCEPT_MARKER + '\n' + this.config.comments.accept),
            ]);
        }
        else if (issueData.numComments < this.config.numCommentsOverride) {
            const state = {};
            for await (const page of issue.getComments()) {
                for (const comment of page) {
                    if (comment.body.includes(exports.CREATE_MARKER)) {
                        state.initTimestamp = comment.timestamp;
                    }
                    if (comment.body.includes(exports.WARN_MARKER)) {
                        state.warnTimestamp = comment.timestamp;
                    }
                }
            }
            if (!state.initTimestamp) {
                if (this.config.comments.init) {
                    await new FeatureRequestOnMilestone(issue, this.config.comments.init, this.config.milestones.candidateID).run();
                }
            }
            else if (!state.warnTimestamp) {
                if (this.daysSince(state.initTimestamp) >
                    this.config.delays.close - this.config.delays.warn) {
                    (0, utils_1.safeLog)(`Issue #${issueData.number} nearing rejection`);
                    await issue.postComment(exports.WARN_MARKER + '\n' + this.config.comments.warn);
                }
            }
            else if (this.daysSince(state.warnTimestamp) > this.config.delays.warn) {
                (0, utils_1.safeLog)(`Issue #${issueData.number} rejected`);
                await issue.postComment(exports.REJECT_MARKER + '\n' + this.config.comments.reject);
                await issue.closeIssue('not_planned');
                if (this.config.comments.rejectLabel) {
                    await issue.addLabel(this.config.comments.rejectLabel);
                }
            }
        }
        else {
            (0, utils_1.safeLog)(`Issue #${issueData.number} has hot discussion. Ignoring.`);
        }
    }
    daysSince(timestamp) {
        return (Date.now() - timestamp) / 1000 / 60 / 60 / 24;
    }
}
exports.FeatureRequestQueryer = FeatureRequestQueryer;
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
        if (!issue)
            return;
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
        if (!issue)
            return;
        if (issue.open && ((_a = issue.milestone) === null || _a === void 0 ? void 0 : _a.milestoneId) === this.milestone) {
            await this.github.postComment(exports.CREATE_MARKER + '\n' + this.comment);
        }
    }
}
exports.FeatureRequestOnMilestone = FeatureRequestOnMilestone;
//# sourceMappingURL=FeatureRequest.js.map