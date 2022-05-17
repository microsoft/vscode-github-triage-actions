"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuildChat = void 0;
const web_api_1 = require("@slack/web-api");
const utils_1 = require("../common/utils");
class BuildChat {
    constructor(octokit, issue, options) {
        this.octokit = octokit;
        this.issue = issue;
        this.options = options;
        this.pr = options.payload.pr;
    }
    async postMessage(message) {
        const web = new web_api_1.WebClient(this.options.slackToken);
        const memberships = await listAllMemberships(web);
        const codereviewChannel = this.options.codereviewChannel &&
            memberships.find((m) => m.name === this.options.codereviewChannel);
        if (!codereviewChannel) {
            throw Error(`Slack channel not found: ${this.options.codereviewChannel}`);
        }
        await web.chat.postMessage({
            text: message,
            link_names: true,
            channel: codereviewChannel.id,
            as_user: true,
        });
    }
    async run() {
        if (this.pr.draft) {
            (0, utils_1.safeLog)('PR is draft, ignoring');
            return;
        }
        const data = await this.issue.getIssue();
        const author = data.author;
        if (!(await this.issue.hasWriteAccess(author))) {
            (0, utils_1.safeLog)('Issue author not team member, ignoring');
            return;
        }
        const tasks = [];
        if (!data.assignee) {
            tasks.push(this.issue.addAssignee(author.name));
        }
        tasks.push((async () => {
            const currentMilestone = await this.issue.getCurrentRepoMilestone();
            if (!data.milestone && currentMilestone) {
                await this.issue.setMilestone(currentMilestone);
            }
        })());
        tasks.push((async () => {
            var _a, _b, _c, _d;
            const [existingReviews, existingRequests] = await Promise.all([
                this.octokit.pulls.listReviews({
                    owner: this.options.payload.owner,
                    repo: this.options.payload.repo,
                    pull_number: this.options.payload.pr.number,
                }),
                this.octokit.pulls.listReviewRequests({
                    owner: this.options.payload.owner,
                    repo: this.options.payload.repo,
                    pull_number: this.options.payload.pr.number,
                }),
            ]);
            const hasExisting = (_b = (_a = existingReviews === null || existingReviews === void 0 ? void 0 : existingReviews.data) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : (_d = (_c = existingRequests === null || existingRequests === void 0 ? void 0 : existingRequests.data) === null || _c === void 0 ? void 0 : _c.users) === null || _d === void 0 ? void 0 : _d.length;
            if (hasExisting) {
                (0, utils_1.safeLog)('had existing review requests, exiting');
                return;
            }
            const changedFilesMessage = `${this.pr.changed_files} file` + (this.pr.changed_files > 1 ? 's' : '');
            const diffMessage = `+${this.pr.additions.toLocaleString()} -${this.pr.deletions.toLocaleString()}, ${changedFilesMessage}`;
            const message = `${this.pr.owner}: \`${diffMessage}\` [${this.pr.title}](${this.pr.url})`;
            (0, utils_1.safeLog)(message);
            await this.postMessage(message);
        })());
        await Promise.all(tasks);
    }
}
exports.BuildChat = BuildChat;
async function listAllMemberships(web) {
    var _a, _b;
    let groups;
    const channels = [];
    do {
        groups = (await web.conversations.list({
            types: 'public_channel,private_channel',
            cursor: (_a = groups === null || groups === void 0 ? void 0 : groups.response_metadata) === null || _a === void 0 ? void 0 : _a.next_cursor,
            limit: 100,
        }));
        channels.push(...groups.channels);
    } while ((_b = groups.response_metadata) === null || _b === void 0 ? void 0 : _b.next_cursor);
    return channels.filter((c) => c.is_member);
}
//# sourceMappingURL=CodeReviewChat.js.map