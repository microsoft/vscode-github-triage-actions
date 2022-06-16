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
const slackToken = (0, utils_1.getRequiredInput)('slack_token');
const elevatedUserToken = (0, utils_1.getInput)('slack_user_token');
const auth = (0, utils_1.getRequiredInput)('token');
const channel = (0, utils_1.getRequiredInput)('notification_channel');
class CodeReviewChatAction extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'CodeReviewChat';
    }
    async onClosed(_issue, payload) {
        if (!payload.pull_request || !payload.repository || !payload.pull_request.html_url) {
            throw Error('expected payload to contain pull request url');
        }
        await new CodeReviewChat_1.CodeReviewChatDeleter(slackToken, elevatedUserToken, channel, payload.pull_request.html_url).run();
    }
    async onOpened(issue, payload) {
        var _a;
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
                    title: payload.pull_request.title,
                },
            },
        }).run();
    }
}
new CodeReviewChatAction().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map