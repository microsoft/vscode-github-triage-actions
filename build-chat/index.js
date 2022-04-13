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
        const slackToken = (0, utils_1.getInput)('slack_token');
        if (!slackToken) {
            return;
        }
        const auth = (0, utils_1.getRequiredInput)('token');
        const github = new rest_1.Octokit({ auth });
        await (0, BuildChat_1.buildChat)(github, (0, utils_1.getRequiredInput)('workflow_run_url'), {
            slackToken,
            storageConnectionString: (0, utils_1.getInput)('storage_connection_string') || undefined,
            notifyAuthors: (0, utils_1.getInput)('notify_authors') === 'true',
            notificationChannel: (0, utils_1.getInput)('notification_channel') || undefined,
            logChannel: (0, utils_1.getInput)('log_channel') || undefined,
        });
    }
}
new BuildChatAction().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map