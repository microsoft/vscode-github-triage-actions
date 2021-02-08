"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const rest_1 = require("@octokit/rest");
const utils_1 = require("../common/utils");
const BuildChat_1 = require("./BuildChat");
const Action_1 = require("../common/Action");
class BuildChatAction extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'BuildChat';
    }
    async onTriggered() {
        const slackToken = utils_1.getRequiredInput('slack_token');
        if (!slackToken) {
            return;
        }
        const auth = utils_1.getRequiredInput('token');
        const github = new rest_1.Octokit({ auth });
        await BuildChat_1.buildChat(github, utils_1.getRequiredInput('workflow_run_url'), {
            slackToken,
            storageConnectionString: utils_1.getInput('storage_connection_string') || undefined,
            notifyAuthors: utils_1.getInput('notify_authors') === 'true',
            notificationChannel: utils_1.getInput('notification_channel') || undefined,
            logChannel: utils_1.getInput('log_channel') || undefined,
        });
    }
}
new BuildChatAction().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map