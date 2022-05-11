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
        });
    }
    async run() {
        var _a, _b;
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
        if (!data.assignee) {
            await this.issue.addAssignee(author.name);
        }
        const currentMilestone = await this.issue.getCurrentRepoMilestone();
        if (!data.milestone && currentMilestone) {
            await this.issue.setMilestone(currentMilestone);
        }
        const existing = await this.octokit.pulls.listReviewRequests({
            owner: this.options.payload.owner,
            repo: this.options.payload.repo,
            pull_number: this.options.payload.pr.number,
        });
        const hasRequests = (_b = (_a = existing === null || existing === void 0 ? void 0 : existing.data) === null || _a === void 0 ? void 0 : _a.users) === null || _b === void 0 ? void 0 : _b.length;
        if (hasRequests) {
            (0, utils_1.safeLog)('had existing review requests, exiting');
            return;
        }
        const changedFilesMessage = `${this.pr.changed_files} file` + (this.pr.changed_files > 1 ? 's' : '');
        const message = `${this.pr.owner}
+${this.pr.additions.toLocaleString()} | -${this.pr.deletions.toLocaleString()} | ${changedFilesMessage}
${this.pr.url}`;
        (0, utils_1.safeLog)(message);
        await this.postMessage(message);
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