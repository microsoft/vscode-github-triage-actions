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
class CodeReviewChatAction extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'CodeReviewChat';
    }
    async onOpened(issue, payload) {
        if (!payload.pull_request || !payload.repository) {
            throw Error('expected payload to contain pull request and repository');
        }
        const slackToken = (0, utils_1.getInput)('slack_token');
        if (!slackToken) {
            return;
        }
        const auth = (0, utils_1.getRequiredInput)('token');
        const github = new rest_1.Octokit({ auth });
        await new Promise((resolve) => setTimeout(resolve, 3 * 60 * 1000));
        await new CodeReviewChat_1.BuildChat(github, issue, {
            slackToken,
            storageConnectionString: (0, utils_1.getRequiredInput)('storage_connection_string'),
            codereviewChannel: (0, utils_1.getRequiredInput)('notification_channel'),
            payload: {
                owner: payload.repository.owner.login,
                repo: payload.repository.name,
                pr: {
                    number: payload.pull_request.number,
                    body: payload.pull_request.body || '',
                    additions: payload.pull_request.additions,
                    deletions: payload.pull_request.deletions,
                    changed_files: payload.pull_request.changed_files,
                    url: payload.pull_request.html_url || '',
                    owner: payload.pull_request.user.login,
                },
            },
        }).run();
    }
}
new CodeReviewChatAction().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map