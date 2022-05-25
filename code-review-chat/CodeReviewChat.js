"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeReviewChat = exports.CodeReviewChatDeleter = void 0;
const web_api_1 = require("@slack/web-api");
const utils_1 = require("../common/utils");
class Chatter {
    constructor(slackToken, notificationChannel) {
        this.slackToken = slackToken;
        this.notificationChannel = notificationChannel;
    }
    async getChat() {
        const web = new web_api_1.WebClient(this.slackToken);
        const memberships = await listAllMemberships(web);
        const codereviewChannel = this.notificationChannel && memberships.find((m) => m.name === this.notificationChannel);
        if (!codereviewChannel) {
            throw Error(`Slack channel not found: ${this.notificationChannel}`);
        }
        return { client: web, channel: codereviewChannel.id };
    }
}
class CodeReviewChatDeleter extends Chatter {
    constructor(slackToken, notificationChannel, prUrl, botName) {
        super(slackToken, notificationChannel);
        this.prUrl = prUrl;
        this.botName = botName;
    }
    async run() {
        const { client, channel } = await this.getChat();
        const response = await client.conversations.history({
            channel,
        });
        if (!response.ok || !response.messages) {
            throw Error('Error getting channel history');
        }
        const messages = response.messages;
        const message = messages === null || messages === void 0 ? void 0 : messages.filter((message) => { var _a; return (_a = message.text) === null || _a === void 0 ? void 0 : _a.includes(this.prUrl); })[0];
        if (!message) {
            (0, utils_1.safeLog)('no message found, exiting');
        }
        try {
            await client.chat.delete({
                channel,
                ts: message.ts,
            });
        }
        catch (e) {
            (0, utils_1.safeLog)('error deleting message, probably posted by some human');
        }
    }
}
exports.CodeReviewChatDeleter = CodeReviewChatDeleter;
class CodeReviewChat extends Chatter {
    constructor(octokit, issue, options) {
        super(options.slackToken, options.codereviewChannel);
        this.octokit = octokit;
        this.issue = issue;
        this.options = options;
        this.pr = options.payload.pr;
    }
    async postMessage(message) {
        const { client, channel } = await this.getChat();
        await client.chat.postMessage({
            text: message,
            channel,
            link_names: true,
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
            var _a, _b;
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
            // Check if has existing reviews made ignoring PR author since comments they leave count as reviews
            const hasExistingReview = existingReviews.data.some((review) => {
                return review.user.login !== author.name;
            });
            // Check to see if there is an existing review or review request. We don't check if the author is part of the review request as that isn't possible
            const hasExisting = hasExistingReview || ((_b = (_a = existingRequests === null || existingRequests === void 0 ? void 0 : existingRequests.data) === null || _a === void 0 ? void 0 : _a.users) === null || _b === void 0 ? void 0 : _b.length);
            if (hasExisting) {
                (0, utils_1.safeLog)('had existing review requests, exiting');
                return;
            }
            const cleanTitle = this.pr.title.replace(/`/g, '');
            const changedFilesMessage = `${this.pr.changed_files} file` + (this.pr.changed_files > 1 ? 's' : '');
            const diffMessage = `+${this.pr.additions.toLocaleString()} -${this.pr.deletions.toLocaleString()}, ${changedFilesMessage}`;
            const message = `${this.pr.owner}: \`${diffMessage}\` <${this.pr.url}|${cleanTitle}>`;
            (0, utils_1.safeLog)(message);
            await this.postMessage(message);
        })());
        await Promise.all(tasks);
    }
}
exports.CodeReviewChat = CodeReviewChat;
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