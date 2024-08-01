"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscodeTools_1 = require("../api/vscodeTools");
const Action_1 = require("../common/Action");
const utils_1 = require("../common/utils");
const ReviewReminder_1 = require("./ReviewReminder");
const slackToken = (0, utils_1.getRequiredInput)('slack_token');
class ReviewReminderAction extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'ReviewReminder';
    }
    async onTriggered() {
        const auth = await this.getToken();
        await new ReviewReminder_1.ReviewReminder(auth, slackToken, new vscodeTools_1.VSCodeToolsAPIManager()).run();
    }
}
new ReviewReminderAction().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map