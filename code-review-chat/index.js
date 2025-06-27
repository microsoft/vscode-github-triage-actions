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
    async closedOrDraftHandler(_issue, pr) {
        await new CodeReviewChat_1.CodeReviewChatDeleter(slackToken, elevatedUserToken, channelId, pr.url).run();
    }
    async onClosed(_issue, pr) {
        await this.closedOrDraftHandler(_issue, pr);
    }
    async onConvertedToDraft(_issue, pr) {
        await this.closedOrDraftHandler(_issue, pr);
    }
    async onOpened(issue, pr) {
        const auth = await this.getToken();
        const github = new rest_1.Octokit({ auth });
        await new Promise((resolve) => setTimeout(resolve, 1 * 60 * 1000));
        await this.executeCodeReviewChat(github, issue, pr, false);
    }
    async executeCodeReviewChat(github, issue, pr, external) {
        return new CodeReviewChat_1.CodeReviewChat(github, new vscodeTools_1.VSCodeToolsAPIManager(), issue, {
            slackToken,
            codereviewChannelId: channelId,
            payload: {
                owner: issue.repoOwner,
                repo: issue.repoName,
                repo_url: pr.url,
                repo_full_name: `${issue.repoOwner}/${issue.repoName}`,
                // https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads#pull_request
                pr: pr,
            },
        }, pr.number, external).run();
    }
    /**
     * TODO @lramos15 Extend support possibly to the base action
     */
    async onSubmitReview(issue, pr) {
        var _a;
        if (pr.state === 'closed') {
            // PR was merged and a review was submitted after merge. Skip posting message
            (0, utils_1.safeLog)(`PR was already merged. Skipping posting message`);
            return;
        }
        const toolsAPI = new vscodeTools_1.VSCodeToolsAPIManager();
        const teamMembers = new Set((await toolsAPI.getTeamMembers()).map((t) => t.id));
        const auth = await this.getToken();
        const github = new rest_1.Octokit({ auth });
        const meetsThreshold = await (0, CodeReviewChat_1.meetsReviewThreshold)(github, teamMembers, pr.number, issue.repoName, issue.repoOwner, issue);
        // Only delete this message if the review threshold has been met
        if (meetsThreshold) {
            (0, utils_1.safeLog)(`Review threshold met, deleting ${pr.url}}`);
            await this.closedOrDraftHandler(issue, pr);
        }
        // TODO @lramos15, possibly move more of this into CodeReviewChat.ts to keep index smal
        // Check if the PR author is in the team
        const author = pr.user.login;
        if (!teamMembers.has(author) && pr.user.type !== 'Bot') {
            (0, utils_1.safeLog)('PR author is not in the team, checking if they need to be posted for another review');
            const teamMemberReviews = await (0, CodeReviewChat_1.getTeamMemberReviews)(github, teamMembers, pr.number, issue.repoName, issue.repoOwner, issue, true /* isExternalPR */);
            (0, utils_1.safeLog)(`Found ${(_a = teamMemberReviews === null || teamMemberReviews === void 0 ? void 0 : teamMemberReviews.length) !== null && _a !== void 0 ? _a : 0} reviews from team members`);
            // Get only the approving reviews from team members
            const approvingReviews = teamMemberReviews === null || teamMemberReviews === void 0 ? void 0 : teamMemberReviews.filter((review) => {
                var _a;
                (0, utils_1.safeLog)(`Reviewer: ${(_a = review === null || review === void 0 ? void 0 : review.user) === null || _a === void 0 ? void 0 : _a.login} - ${review.state}`);
                return review.state === 'APPROVED';
            });
            if (approvingReviews && approvingReviews.length === 1) {
                (0, utils_1.safeLog)(`External PR with one review received, posting to receive a second`);
                await this.executeCodeReviewChat(github, issue, pr, true);
            }
        }
    }
    // Handles the event when a review is assigned to a pull request
    async onAssignedReview(issue) {
        // Get the issue data
        const issueData = await issue.getIssue();
        if (!issueData)
            return;
        // If there are multiple assignees and the issue has the 'triage-needed' label
        if (issueData.assignees.length > 1 && issueData.labels.includes('triage-needed')) {
            // Get the username of the assigner of the first assignee
            const assigner = await issue.getAssigner(issueData.assignees[0]);
            const toolsAPI = new vscodeTools_1.VSCodeToolsAPIManager();
            const teamMember = await toolsAPI.getTeamMemberFromGitHubId(assigner);
            // If the assigner is a team member, remove the 'triage-needed' label
            if (teamMember) {
                // Log the assigner and remove the 'triage-needed' label
                (0, utils_1.safeLog)(`Assigner: ${assigner}`);
                await issue.removeLabel('triage-needed');
                return;
            }
        }
    }
    async onDismissedReview(issue, pr) {
        if (pr.state === 'closed') {
            // PR was merged and a review was submitted after merge. Skip posting message
            (0, utils_1.safeLog)(`PR was already merged. Skipping posting message`);
            return;
        }
        await this.executeCodeReviewChat(new rest_1.Octokit({ auth: await this.getToken() }), issue, pr, false /* external */);
        (0, utils_1.safeLog)('Review dismissed, no action taken');
    }
    async onTriggered() {
        const auth = await this.getToken();
        const github = new rest_1.Octokit({ auth });
        const owner = (0, utils_1.getRequiredInput)('owner');
        const repo = (0, utils_1.getRequiredInput)('repo');
        const action = (0, utils_1.getRequiredInput)('action');
        const pr_number = parseInt((0, utils_1.getRequiredInput)('pr_number'));
        const prFromApi = (await github.pulls.get({
            pull_number: pr_number,
            owner,
            repo,
        })).data;
        const pr = (0, CodeReviewChat_1.createPRObject)(prFromApi);
        const octokitIssue = new octokit_1.OctoKitIssue(auth, { owner, repo }, { number: pr_number });
        switch (action) {
            case 'opened':
            case 'ready_for_review':
                await this.onOpened(octokitIssue, pr);
                break;
            case 'submitted':
                await this.onSubmitReview(octokitIssue, pr);
                break;
            case 'closed':
                await this.onClosed(octokitIssue, pr);
                break;
            case 'converted_to_draft':
                await this.onConvertedToDraft(octokitIssue, pr);
                break;
            // These are part of the webhook chain, let's no-op but allow the CI to pass
            case 'dismissed':
                await this.onDismissedReview(octokitIssue, pr);
                break;
            case 'synchronize':
            case 'reopened':
                break;
            case 'assigned':
                await this.onAssignedReview(octokitIssue);
                break;
            case 'create': // ref created, noop
                break;
            default:
                throw Error(`Unknown action: ${action}`);
        }
        return;
    }
}
new CodeReviewChatAction().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map