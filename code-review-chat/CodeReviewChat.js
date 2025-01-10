"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.meetsReviewThreshold = exports.getTeamMemberReviews = exports.CodeReviewChat = exports.CodeReviewChatDeleter = exports.createPRObject = void 0;
const web_api_1 = require("@slack/web-api");
const utils_1 = require("../common/utils");
function createPRObject(pullRequestFromApi) {
    var _a, _b, _c, _d;
    const pr = {
        number: pullRequestFromApi.number,
        body: pullRequestFromApi.body || '',
        additions: pullRequestFromApi.additions,
        deletions: pullRequestFromApi.deletions,
        changed_files: pullRequestFromApi.changed_files,
        url: pullRequestFromApi.html_url || '',
        owner: pullRequestFromApi.user.login,
        draft: pullRequestFromApi.draft || false,
        baseBranchName: (_a = pullRequestFromApi.base.ref) !== null && _a !== void 0 ? _a : '',
        headBranchName: (_b = pullRequestFromApi.head.ref) !== null && _b !== void 0 ? _b : '',
        title: pullRequestFromApi.title,
        headLabel: ((_c = pullRequestFromApi.head.repo) === null || _c === void 0 ? void 0 : _c.full_name) || '',
        fork: ((_d = pullRequestFromApi.head.repo) === null || _d === void 0 ? void 0 : _d.fork) || false,
    };
    return pr;
}
exports.createPRObject = createPRObject;
class Chatter {
    constructor(slackToken, notificationChannelID) {
        this.slackToken = slackToken;
        this.notificationChannelID = notificationChannelID;
    }
    async getChat() {
        const web = new web_api_1.WebClient(this.slackToken);
        if (!this.notificationChannelID) {
            throw Error(`Slack channel not provided: ${this.notificationChannelID}`);
        }
        return { client: web, channel: this.notificationChannelID };
    }
}
class CodeReviewChatDeleter extends Chatter {
    constructor(slackToken, slackElevatedUserToken, notificationChannelId, prUrl) {
        super(slackToken, notificationChannelId);
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
    constructor(octokit, toolsAPI, issue, options, pullRequestNumber, _externalContributorPR) {
        super(options.slackToken, options.codereviewChannelId);
        this.octokit = octokit;
        this.toolsAPI = toolsAPI;
        this.issue = issue;
        this.options = options;
        this.pullRequestNumber = pullRequestNumber;
        this._externalContributorPR = _externalContributorPR;
    }
    async postMessage(message) {
        const { client, channel } = await this.getChat();
        await client.chat.postMessage({
            text: message,
            channel,
            link_names: true,
        });
    }
    async postExternalPRMessage(pr) {
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
        const message = this.getSlackMessage(pr);
        await this.postMessage(message);
    }
    getSlackMessage(pr) {
        const cleanTitle = pr.title.replace(/`/g, '').replace('https://github.com/', '');
        const changedFilesMessage = `${pr.changed_files} file` + (pr.changed_files > 1 ? 's' : '');
        const diffMessage = `+${pr.additions.toLocaleString()} -${pr.deletions.toLocaleString()}, ${changedFilesMessage}`;
        // The message that states which repo the PR is in, only populated for non microsoft/vscode PRs
        const repoMessage = this.options.payload.repo_full_name === 'microsoft/vscode'
            ? ':'
            : ` (in ${this.options.payload.repo_full_name}):`;
        const githubUrl = `${pr.url}/files`;
        const vscodeDevUrl = pr.url.replace('https://', 'https://insiders.vscode.dev/');
        const externalPrefix = this._externalContributorPR ? '⚠️[EXTERNAL]⚠️ ' : '';
        const message = `${externalPrefix}*${cleanTitle}* by _${pr.owner}_${repoMessage} \`${diffMessage}\` <${githubUrl}|Review (GH)> | <${vscodeDevUrl}|Review (VSCode)>`;
        return message;
    }
    async run() {
        var _a;
        // Must request the PR again from the octokit api as it may have changed since creation
        const prFromApi = (await this.octokit.pulls.get({
            pull_number: this.pullRequestNumber,
            owner: this.options.payload.owner,
            repo: this.options.payload.repo,
        })).data;
        const pr = createPRObject(prFromApi);
        if (pr.draft) {
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
        const default_branch = (await this.octokit.repos.get({
            owner: this.options.payload.owner,
            repo: this.options.payload.repo,
        })).data.default_branch;
        // TODO @lramos15 possibly make this configurable
        if (!pr.baseBranchName.startsWith(default_branch) || pr.baseBranchName.startsWith('release')) {
            (0, utils_1.safeLog)('PR is on a non-main or release branch, ignoring');
            return;
        }
        const isEndGame = (_a = (await (0, utils_1.isInsiderFrozen)())) !== null && _a !== void 0 ? _a : false;
        // This is an external PR which already received one review and is just awaiting a second
        const data = await this.issue.getIssue();
        if (this._externalContributorPR) {
            const externalTasks = [];
            const currentMilestone = await this.issue.getCurrentRepoMilestone(isEndGame);
            if (!data.milestone && currentMilestone) {
                externalTasks.push(this.issue.setMilestone(currentMilestone));
            }
            externalTasks.push(this.postExternalPRMessage(pr));
            await Promise.all(externalTasks);
            return;
        }
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
            const currentMilestone = await this.issue.getCurrentRepoMilestone(isEndGame);
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
            const message = this.getSlackMessage(pr);
            (0, utils_1.safeLog)(message);
            await this.postMessage(message);
        })());
        // Trigger build for forked PRs by adding a comment
        if (pr.fork) {
            tasks.push((async () => {
                await this.octokit.issues.createComment({
                    owner: this.options.payload.owner,
                    repo: this.options.payload.repo,
                    issue_number: this.pullRequestNumber,
                    body: 'This PR originates from a fork. If the changes appear safe, you can trigger the pipeline by commenting `/AzurePipelines run`.',
                });
            })());
        }
        await Promise.all(tasks);
    }
}
exports.CodeReviewChat = CodeReviewChat;
async function getTeamMemberReviews(octokit, teamMembers, prNumber, repo, owner, ghIssue, isExternalPR) {
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
    // Only take the latest review of each user
    const latestReviews = new Map();
    for (const review of reviews.data) {
        if (!review.user) {
            continue;
        }
        if (review.user.name === author || review.user.login === author) {
            continue;
        }
        if (review.state === 'COMMENTED') {
            continue;
        }
        const isTeamMember = teamMembers.has(review.user.login);
        if (!isTeamMember) {
            continue;
        }
        const reviewTimestamp = review.submitted_at ? new Date(review.submitted_at).getTime() : 0;
        // Check that the review occured after the last commit
        if (reviewTimestamp < lastCommitUnixTimestamp) {
            continue;
        }
        // Check that the team member review occurred in the last 24 hours for external PRs
        const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
        if (isExternalPR && reviewTimestamp < twentyFourHoursAgo) {
            continue;
        }
        const existingReview = latestReviews.get(review.user.login);
        if (!existingReview || reviewTimestamp > new Date(existingReview.submitted_at).getTime()) {
            latestReviews.set(review.user.login, review);
        }
    }
    return Array.from(latestReviews.values());
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
//# sourceMappingURL=CodeReviewChat.js.map