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
    constructor(slackToken, slackElevatedUserToken, notificationChannel, prUrl) {
        super(slackToken, notificationChannel);
        this.prUrl = prUrl;
        this.elevatedClient = slackElevatedUserToken ? new web_api_1.WebClient(slackElevatedUserToken) : undefined;
    }
    async run() {
        const { client, channel } = await this.getChat();
        // Get the last 20 messages (don't bother looking further than that)
        const response = await client.conversations.history({
            channel,
            limit: 20,
        });
        if (!response.ok || !response.messages) {
            throw Error('Error getting channel history');
        }
        const messages = response.messages;
        const messagesToDelete = messages.filter((message) => {
            const isCodeReviewMessage = message.text.includes(this.prUrl);
            // If it has a subtype it means its a special slack message which we want to delete
            if (message.subtype) {
                return true;
            }
            if (this.elevatedClient && message.reactions) {
                // If we have an elevated client we can delete the message as long it has a "white_check_mark" reaction
                return (isCodeReviewMessage ||
                    message.reactions.some((reaction) => reaction.name === 'white_check_mark'));
            }
            return isCodeReviewMessage;
        });
        // Delete all the replies to messages queued for deletion
        const replies = [];
        for (const message of messagesToDelete) {
            // If reply count is greater than 1 we must fetch the replies
            if (message.reply_count) {
                const replyThread = await client.conversations.replies({
                    channel,
                    ts: message.ts,
                });
                if (!replyThread.ok || !replyThread.messages) {
                    (0, utils_1.safeLog)('Error getting messages replies');
                }
                else {
                    // Pushback everything but the first reply since the first reply is the original message
                    replies.push(...replyThread.messages.slice(1));
                }
            }
        }
        messagesToDelete.push(...replies);
        if (messagesToDelete.length === 0) {
            (0, utils_1.safeLog)('no message found, exiting');
            return;
        }
        try {
            // Attempt to use the correct client to delete the messages
            for (const message of messagesToDelete) {
                // Can't delete already deleted messages.
                // The reason they're in the array is so we can get their replies
                if (message.subtype === 'tombstone') {
                    continue;
                }
                if (this.elevatedClient) {
                    await this.elevatedClient.chat.delete({
                        channel,
                        ts: message.ts,
                        as_user: true,
                    });
                }
                else {
                    await client.chat.delete({
                        channel,
                        ts: message.ts,
                    });
                }
            }
        }
        catch (e) {
            (0, utils_1.safeLog)(`Error deleting message: ${e.message}`);
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
        });
    }
    async run() {
        // Must request the PR again from the octokit api as it may have changed since creation
        const prFromApi = (await this.octokit.pulls.get({
            pull_number: this.pr.number,
            owner: this.options.payload.owner,
            repo: this.options.payload.repo,
        })).data;
        if (prFromApi.draft) {
            (0, utils_1.safeLog)('PR is draft, ignoring');
            return;
        }
        // A small set of repos which we don't want to be posted
        const ignoredRepos = ['vscode-extensions-loc', 'vscode-loc-drop'];
        // Ignore PRs from ignored repos
        if (ignoredRepos.includes(this.options.payload.repo)) {
            (0, utils_1.safeLog)('PR is from ignored repo, ignoring');
            return;
        }
        // TODO @lramos15 possibly make this configurable
        if (this.pr.baseBranchName.startsWith('release')) {
            (0, utils_1.safeLog)('PR is on a release branch, ignoring');
            return;
        }
        const data = await this.issue.getIssue();
        const author = data.author;
        // Author must have write access to the repo or be a bot
        if ((!(await this.issue.hasWriteAccess(author)) && !author.isGitHubApp) ||
            author.name.includes('dependabot')) {
            (0, utils_1.safeLog)('Issue author not team member, ignoring');
            return;
        }
        const tasks = [];
        if (!data.assignee && !author.isGitHubApp) {
            tasks.push(this.issue.addAssignee(author.name));
        }
        tasks.push((async () => {
            const currentMilestone = await this.issue.getCurrentRepoMilestone();
            if (!data.milestone && currentMilestone) {
                await this.issue.setMilestone(currentMilestone);
            }
        })());
        tasks.push((async () => {
            var _a, _b, _c;
            const [existingReviews, existingRequests] = await Promise.all([
                this.octokit.pulls.listReviews({
                    owner: this.options.payload.owner,
                    repo: this.options.payload.repo,
                    pull_number: this.options.payload.pr.number,
                }),
                this.octokit.pulls.listRequestedReviewers({
                    owner: this.options.payload.owner,
                    repo: this.options.payload.repo,
                    pull_number: this.options.payload.pr.number,
                }),
            ]);
            // Check if there is any exisitng review. This excludes the author themselves as they don't count
            const hasExistingReview = (_a = existingReviews === null || existingReviews === void 0 ? void 0 : existingReviews.data) === null || _a === void 0 ? void 0 : _a.some((review) => {
                var _a;
                return ((_a = review.user) === null || _a === void 0 ? void 0 : _a.login) !== author.name;
            });
            // Check to see if there is an existing review or review request. We don't check if the author is part of the review request as that isn't possible
            const hasExisting = hasExistingReview || ((_c = (_b = existingRequests === null || existingRequests === void 0 ? void 0 : existingRequests.data) === null || _b === void 0 ? void 0 : _b.users) === null || _c === void 0 ? void 0 : _c.length);
            if (hasExisting) {
                (0, utils_1.safeLog)('had existing review requests, exiting');
                process.exit(0);
            }
            const cleanTitle = this.pr.title.replace(/`/g, '');
            const changedFilesMessage = `${this.pr.changed_files} file` + (this.pr.changed_files > 1 ? 's' : '');
            const diffMessage = `+${this.pr.additions.toLocaleString()} -${this.pr.deletions.toLocaleString()}, ${changedFilesMessage}`;
            // The message that states which repo the PR is in, only populated for non microsoft/vscode PRs
            const repoMessage = this.options.payload.repo_full_name === 'microsoft/vscode'
                ? ':'
                : ` (in ${this.options.payload.repo_full_name}):`;
            const githubUrl = this.pr.url;
            const vscodeDevUrl = this.pr.url.replace('https://', 'https://insiders.vscode.dev/');
            // Nicely formatted chat message
            const message = `*${cleanTitle}* by _${this.pr.owner}_${repoMessage} \`${diffMessage}\` <${githubUrl}|Review (GH)> | <${vscodeDevUrl}|Review (VSCode)>`;
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
        try {
            groups = (await web.conversations.list({
                types: 'public_channel,private_channel',
                cursor: (_a = groups === null || groups === void 0 ? void 0 : groups.response_metadata) === null || _a === void 0 ? void 0 : _a.next_cursor,
                limit: 100,
            }));
            channels.push(...groups.channels);
        }
        catch (err) {
            (0, utils_1.safeLog)(`Error listing channels: ${err}`);
            groups = undefined;
        }
    } while ((_b = groups === null || groups === void 0 ? void 0 : groups.response_metadata) === null || _b === void 0 ? void 0 : _b.next_cursor);
    return channels.filter((c) => c.is_member);
}
//# sourceMappingURL=CodeReviewChat.js.map