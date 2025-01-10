"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const rest_1 = require("@octokit/rest");
const octokit_1 = require("../api/octokit");
const vscodeTools_1 = require("../api/vscodeTools");
const Action_1 = require("../common/Action");
const utils_1 = require("../common/utils");
const CodeReviewChat_1 = require("./CodeReviewChat");
const slackToken = (0, utils_1.getRequiredInput)('slack_token');
const elevatedUserToken = (0, utils_1.getInput)('slack_user_token');
const channelId = (0, utils_1.getRequiredInput)('notification_channel_id');
class CodeReviewChatAction extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'CodeReviewChat';
    }
    async closedOrDraftHandler(_issue, payload) {
        if (!payload.pull_request || !payload.repository || !payload.pull_request.html_url) {
            throw Error('expected payload to contain pull request url');
        }
        await new CodeReviewChat_1.CodeReviewChatDeleter(slackToken, elevatedUserToken, channelId, payload.pull_request.html_url).run();
    }
    async onClosed(_issue, payload) {
        await this.closedOrDraftHandler(_issue, payload);
    }
    async onConvertedToDraft(_issue, payload) {
        await this.closedOrDraftHandler(_issue, payload);
    }
    async onOpened(issue, payload) {
        if (!payload.pull_request || !payload.repository) {
            throw Error('expected payload to contain pull request and repository');
        }
        const auth = await this.getToken();
        const github = new rest_1.Octokit({ auth });
        await new Promise((resolve) => setTimeout(resolve, 1 * 60 * 1000));
        await this.executeCodeReviewChat(github, issue, payload, false);
    }
    async executeCodeReviewChat(github, issue, payload, external) {
        var _a;
        if (!payload.pull_request || !payload.repository) {
            throw Error('expected payload to contain pull request and repository');
        }
        return new CodeReviewChat_1.CodeReviewChat(github, new vscodeTools_1.VSCodeToolsAPIManager(), issue, {
            slackToken,
            codereviewChannelId: channelId,
            payload: {
                owner: payload.repository.owner.login,
                repo: payload.repository.name,
                repo_url: payload.repository.html_url,
                repo_full_name: (_a = payload.repository.full_name) !== null && _a !== void 0 ? _a : payload.repository.name,
                // https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads#pull_request
                pr: (0, CodeReviewChat_1.createPRObject)(payload.pull_request),
            },
        }, payload.pull_request.number, external).run();
    }
    /**
     * TODO @lramos15 Extend support possibly to the base action
     */
    async onSubmitReview(issue, payload) {
        var _a, _b;
        if (!payload.pull_request || !payload.repository) {
            throw Error('expected payload to contain pull request url');
        }
        if (payload.pull_request.state === 'closed') {
            // PR was merged and a review was submitted after merge. Skip posting message
            (0, utils_1.safeLog)(`PR was already merged. Skipping posting message`);
            return;
        }
        const toolsAPI = new vscodeTools_1.VSCodeToolsAPIManager();
        const teamMembers = new Set((await toolsAPI.getTeamMembers()).map((t) => t.id));
        const auth = await this.getToken();
        const github = new rest_1.Octokit({ auth });
        const meetsThreshold = await (0, CodeReviewChat_1.meetsReviewThreshold)(github, teamMembers, payload.pull_request.number, payload.repository.name, payload.repository.owner.login, issue);
        // Only delete this message if the review threshold has been met
        if (meetsThreshold) {
            (0, utils_1.safeLog)(`Review threshold met, deleting ${payload.pull_request.html_url}}`);
            await this.closedOrDraftHandler(issue, payload);
        }
        // TODO @lramos15, possibly move more of this into CodeReviewChat.ts to keep index smal
        // Check if the PR author is in the team
        const author = payload.pull_request.user.login;
        if (!teamMembers.has(author) && ((_a = payload.pull_request.user) === null || _a === void 0 ? void 0 : _a.type) !== 'Bot') {
            (0, utils_1.safeLog)('PR author is not in the team, checking if they need to be posted for another review');
            const teamMemberReviews = await (0, CodeReviewChat_1.getTeamMemberReviews)(github, teamMembers, payload.pull_request.number, payload.repository.name, payload.repository.owner.login, issue, true /* isExternalPR */);
            (0, utils_1.safeLog)(`Found ${(_b = teamMemberReviews === null || teamMemberReviews === void 0 ? void 0 : teamMemberReviews.length) !== null && _b !== void 0 ? _b : 0} reviews from team members`);
            // Get only the approving reviews from team members
            const approvingReviews = teamMemberReviews === null || teamMemberReviews === void 0 ? void 0 : teamMemberReviews.filter((review) => {
                var _a;
                (0, utils_1.safeLog)(`Reviewer: ${(_a = review === null || review === void 0 ? void 0 : review.user) === null || _a === void 0 ? void 0 : _a.login} - ${review.state}`);
                return review.state === 'APPROVED';
            });
            if (approvingReviews && approvingReviews.length === 1) {
                (0, utils_1.safeLog)(`External PR with one review received, posting to receive a second`);
                await this.executeCodeReviewChat(github, issue, payload, true);
            }
        }
    }
    // Handles the event when a review is assigned to a pull request
    async onAssignedReview(issue, payload) {
        // Ensure the payload contains pull request and repository information
        if (!payload.pull_request || !payload.repository) {
            throw Error('expected payload to contain pull request url');
        }
        // Get the issue data
        const issueData = await issue.getIssue();
        if (!issueData)
            return;
        // If there are multiple assignees and the issue has the 'triage-needed' label
        if (issueData.assignees.length > 1 && issueData.labels.includes('triage-needed')) {
            // Get the username of the assigner of the first assignee
            const assigner = await issue.getAssigner(issueData.assignees[0]);
            // If the assigner is not the bot itself
            if (assigner !== (0, utils_1.getRequiredInput)('botName')) {
                // Log the assigner and remove the 'triage-needed' label
                (0, utils_1.safeLog)(`Assigner: ${assigner}`);
                await issue.removeLabel('triage-needed');
                return;
            }
        }
    }
    async onTriggered() {
        // This function is only called during a manual workspace dispatch event
        // caused by a webhook, so we know to expect some inputs.
        const action = (0, utils_1.getRequiredInput)('action');
        const pull_request = JSON.parse((0, utils_1.getRequiredInput)('pull_request'));
        const draft = pull_request.draft || false;
        if (draft) {
            (0, utils_1.safeLog)('PR is draft, ignoring');
            return;
        }
        const repository = JSON.parse((0, utils_1.getRequiredInput)('repository'));
        const pr_number = parseInt((0, utils_1.getRequiredInput)('pr_number'));
        const auth = await this.getToken();
        const octokitIssue = new octokit_1.OctoKitIssue(auth, { owner: repository.owner.login, repo: repository.name }, { number: pr_number });
        const payload = { repository, pull_request };
        switch (action) {
            case 'opened':
            case 'ready_for_review':
                await this.onOpened(octokitIssue, payload);
                break;
            case 'submitted':
                await this.onSubmitReview(octokitIssue, payload);
                break;
            case 'closed':
                await this.onClosed(octokitIssue, payload);
                break;
            case 'converted_to_draft':
                await this.onConvertedToDraft(octokitIssue, payload);
                break;
            // These are part of the webhook chain, let's no-op but allow the CI to pass
            case 'dismissed':
            case 'synchronize':
            case 'reopened':
                break;
            case 'assigned':
                await this.onAssignedReview(octokitIssue, payload);
                break;
            default:
                throw Error(`Unknown action: ${action}`);
        }
        return;
    }
}
new CodeReviewChatAction().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map