"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const rest_1 = require("@octokit/rest");
const utils_1 = require("../common/utils");
const CodeReviewChat_1 = require("./CodeReviewChat");
const Action_1 = require("../common/Action");
const octokit_1 = require("../api/octokit");
const slackToken = (0, utils_1.getRequiredInput)('slack_token');
const elevatedUserToken = (0, utils_1.getInput)('slack_user_token');
const auth = (0, utils_1.getRequiredInput)('token');
const channel = (0, utils_1.getRequiredInput)('notification_channel');
class CodeReviewChatAction extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'CodeReviewChat';
    }
    async closedOrDraftHandler(_issue, payload) {
        if (!payload.pull_request || !payload.repository || !payload.pull_request.html_url) {
            throw Error('expected payload to contain pull request url');
        }
        await new CodeReviewChat_1.CodeReviewChatDeleter(slackToken, elevatedUserToken, channel, payload.pull_request.html_url).run();
    }
    async onClosed(_issue, payload) {
        await this.closedOrDraftHandler(_issue, payload);
    }
    async onConvertedToDraft(_issue, payload) {
        await this.closedOrDraftHandler(_issue, payload);
    }
    async onOpened(issue, payload) {
        var _a, _b, _c;
        if (!payload.pull_request || !payload.repository) {
            throw Error('expected payload to contain pull request and repository');
        }
        const github = new rest_1.Octokit({ auth });
        await new Promise((resolve) => setTimeout(resolve, 1 * 60 * 1000));
        await new CodeReviewChat_1.CodeReviewChat(github, issue, {
            slackToken,
            codereviewChannel: channel,
            payload: {
                owner: payload.repository.owner.login,
                repo: payload.repository.name,
                repo_url: payload.repository.html_url,
                repo_full_name: (_a = payload.repository.full_name) !== null && _a !== void 0 ? _a : payload.repository.name,
                // https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads#pull_request
                pr: {
                    number: payload.pull_request.number,
                    body: payload.pull_request.body || '',
                    additions: payload.pull_request.additions,
                    deletions: payload.pull_request.deletions,
                    changed_files: payload.pull_request.changed_files,
                    url: payload.pull_request.html_url || '',
                    owner: payload.pull_request.user.login,
                    draft: payload.pull_request.draft || false,
                    baseBranchName: (_b = payload.pull_request.base.ref) !== null && _b !== void 0 ? _b : '',
                    headBranchName: (_c = payload.pull_request.head.ref) !== null && _c !== void 0 ? _c : '',
                    title: payload.pull_request.title,
                },
            },
        }).run();
    }
    /**
     * TODO @lramos15 Extend support possibly to the base action
     */
    async onSubmitReview(issue, payload) {
        if (!payload.pull_request || !payload.repository) {
            throw Error('expected payload to contain pull request url');
        }
        const github = new rest_1.Octokit({ auth });
        const meetsThreshold = await (0, CodeReviewChat_1.meetsReviewThreshold)(github, payload.pull_request.number, payload.repository.name, payload.repository.owner.login, issue);
        // Only delete this message if the review threshold has been met
        if (meetsThreshold) {
            (0, utils_1.safeLog)(`Review threshold met, deleting ${payload.pull_request.html_url}}`);
            await this.closedOrDraftHandler(issue, payload);
        }
    }
    async onTriggered() {
        // This function is only called during a manual workspace dispatch event
        // caused by a webhook, so we know to expect some inputs.
        const action = (0, utils_1.getRequiredInput)('action');
        const pull_request = JSON.parse((0, utils_1.getRequiredInput)('pull_request'));
        const repository = JSON.parse((0, utils_1.getRequiredInput)('repository'));
        const pr_number = parseInt((0, utils_1.getRequiredInput)('pr_number'));
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
            default:
                throw Error(`Unknown action: ${action}`);
        }
        return;
    }
}
new CodeReviewChatAction().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map