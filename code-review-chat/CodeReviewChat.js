"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.meetsReviewThreshold = exports.getTeamMemberReviews = exports.CodeReviewChat = exports.CodeReviewChatDeleter = void 0;
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
            var _a, _b, _c;
            const isCodeReviewMessage = message.text.includes(this.prUrl);
            // If it has a subtype it means its a special slack message which we want to delete
            if (message.subtype) {
                return true;
            }
            const hasWhiteCheckMark = (_a = message.reactions) === null || _a === void 0 ? void 0 : _a.some((reaction) => reaction.name === 'white_check_mark');
            // Extract PR URL from the chat message. It is in the form https://https://github.com/{repo}/pull/{number}
            const prUrl = (_c = (_b = message.text.match(/https:\/\/github.com\/.*\/pull\/\d+/)) === null || _b === void 0 ? void 0 : _b[0]) !== null && _c !== void 0 ? _c : '';
            if (isCodeReviewMessage) {
                (0, utils_1.safeLog)(`${prUrl} was closed or met review threshold. Deleting the message.`);
            }
            if (this.elevatedClient && message.reactions) {
                if (hasWhiteCheckMark) {
                    (0, utils_1.safeLog)(`Message ${prUrl} has a check mark reaction, deleting it.`);
                }
                // If we have an elevated client we can delete the message as long it has a "white_check_mark" reaction
                return isCodeReviewMessage || hasWhiteCheckMark;
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
    constructor(octokit, toolsAPI, issue, options, _externalContributorPR) {
        super(options.slackToken, options.codereviewChannel);
        this.octokit = octokit;
        this.toolsAPI = toolsAPI;
        this.issue = issue;
        this.options = options;
        this._externalContributorPR = _externalContributorPR;
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
    async postExternalPRMessage() {
        const requestedReviewersAPIResponse = await this.octokit.pulls.listRequestedReviewers({
            owner: this.options.payload.owner,
            repo: this.options.payload.repo,
            pull_number: this.options.payload.pr.number,
        });
        const requestedReviewers = requestedReviewersAPIResponse.data.users.map((user) => user.login);
        if (requestedReviewers.length !== 0) {
            (0, utils_1.safeLog)('A secondary reviewer has been requested for this PR, skipping');
            return;
        }
        const message = this.getSlackMessage();
        await this.postMessage(message);
    }
    getSlackMessage() {
        const cleanTitle = this.pr.title.replace(/`/g, '').replace('https://github.com/', '');
        const changedFilesMessage = `${this.pr.changed_files} file` + (this.pr.changed_files > 1 ? 's' : '');
        const diffMessage = `+${this.pr.additions.toLocaleString()} -${this.pr.deletions.toLocaleString()}, ${changedFilesMessage}`;
        // The message that states which repo the PR is in, only populated for non microsoft/vscode PRs
        const repoMessage = this.options.payload.repo_full_name === 'microsoft/vscode'
            ? ':'
            : ` (in ${this.options.payload.repo_full_name}):`;
        const githubUrl = this.pr.url;
        const vscodeDevUrl = this.pr.url.replace('https://', 'https://insiders.vscode.dev/');
        const externalPrefix = this._externalContributorPR ? 'External PR: ' : '';
        const message = `${externalPrefix}*${cleanTitle}* by _${this.pr.owner}_${repoMessage} \`${diffMessage}\` <${githubUrl}|Review (GH)> | <${vscodeDevUrl}|Review (VSCode)>`;
        return message;
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
        // This is an external PR which already received one review and is just awaiting a second
        if (this._externalContributorPR) {
            await this.postExternalPRMessage();
            return;
        }
        const data = await this.issue.getIssue();
        const teamMembers = new Set((await this.toolsAPI.getTeamMembers()).map((t) => t.id));
        const author = data.author;
        // Author must have write access to the repo or be a bot
        if ((!teamMembers.has(author.name) && !author.isGitHubApp) || author.name.includes('dependabot')) {
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
            var _a, _b;
            const [hasExistingReview, existingRequests] = await Promise.all([
                meetsReviewThreshold(this.octokit, teamMembers, this.options.payload.pr.number, this.options.payload.repo, this.options.payload.owner, this.issue),
                this.octokit.pulls.listRequestedReviewers({
                    owner: this.options.payload.owner,
                    repo: this.options.payload.repo,
                    pull_number: this.options.payload.pr.number,
                }),
            ]);
            // Check to see if there is an existing review or review request. We don't check if the author is part of the review request as that isn't possible
            const hasExisting = hasExistingReview || ((_b = (_a = existingRequests === null || existingRequests === void 0 ? void 0 : existingRequests.data) === null || _a === void 0 ? void 0 : _a.users) === null || _b === void 0 ? void 0 : _b.length);
            if (hasExisting) {
                (0, utils_1.safeLog)('had existing review requests, exiting');
                process.exit(0);
            }
            const message = this.getSlackMessage();
            (0, utils_1.safeLog)(message);
            await this.postMessage(message);
        })());
        await Promise.all(tasks);
    }
}
exports.CodeReviewChat = CodeReviewChat;
async function getTeamMemberReviews(octokit, teamMembers, prNumber, repo, owner, ghIssue) {
    var _a, _b, _c;
    const reviews = await octokit.pulls.listReviews({
        pull_number: prNumber,
        owner,
        repo,
    });
    // Get author of PR
    const author = (await ghIssue.getIssue()).author.name;
    // Get timestamp of last commit
    const lastCommitTimestamp = (_c = (_b = (_a = (await octokit.pulls.listCommits({
        pull_number: prNumber,
        owner,
        repo,
    })).data[0]) === null || _a === void 0 ? void 0 : _a.commit) === null || _b === void 0 ? void 0 : _b.committer) === null || _c === void 0 ? void 0 : _c.date;
    // Convert date string into unix timestamp
    const lastCommitUnixTimestamp = lastCommitTimestamp ? new Date(lastCommitTimestamp).getTime() : 0;
    // Get all reviews that are from team members, excluding the author
    const teamMemberReviews = [];
    for (const review of reviews.data) {
        if (!review.user) {
            continue;
        }
        if (review.user.name === author || review.user.login === author) {
            continue;
        }
        const reviewTimestamp = review.submitted_at ? new Date(review.submitted_at).getTime() : 0;
        // Check that the review occured after the last commit
        if (reviewTimestamp < lastCommitUnixTimestamp) {
            continue;
        }
        const isTeamMember = teamMembers.has(review.user.login);
        if (isTeamMember) {
            teamMemberReviews.push(review);
        }
        return teamMemberReviews;
    }
}
exports.getTeamMemberReviews = getTeamMemberReviews;
async function meetsReviewThreshold(octokit, teamMembers, prNumber, repo, owner, ghIssue) {
    // Get author of PR
    const author = (await ghIssue.getIssue()).author.name;
    const teamMemberReviews = await getTeamMemberReviews(octokit, teamMembers, prNumber, repo, owner, ghIssue);
    // While more expensive to convert from Array -> Set -> Array, we want to ensure the same name isn't double counted if a user has multiple reviews
    const reviewerNames = Array.from(new Set(teamMemberReviews === null || teamMemberReviews === void 0 ? void 0 : teamMemberReviews.map((r) => { var _a, _b; return (_b = (_a = r.user) === null || _a === void 0 ? void 0 : _a.login) !== null && _b !== void 0 ? _b : 'Unknown'; })));
    let meetsReviewThreshold = false;
    // Team members require 1 review, external requires two
    if (teamMembers.has(author)) {
        meetsReviewThreshold = reviewerNames.length >= 1;
    }
    else {
        meetsReviewThreshold = reviewerNames.length >= 2;
    }
    // Some more logging to help diagnose issues
    if (meetsReviewThreshold) {
        (0, utils_1.safeLog)(`Met review threshold: ${reviewerNames.join(', ')}`);
    }
    return meetsReviewThreshold;
}
exports.meetsReviewThreshold = meetsReviewThreshold;
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