"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../common/utils");
const Action_1 = require("../common/Action");
const ReviewReminder_1 = require("./ReviewReminder");
const slackToken = (0, utils_1.getRequiredInput)('slack_token');
const auth = (0, utils_1.getRequiredInput)('token');
const connectionString = (0, utils_1.getRequiredInput)('connection_string');
class ReviewReminderAction extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'ReviewReminder';
    }
    async onTriggered() {
        await new ReviewReminder_1.ReviewReminder(auth, slackToken, connectionString).run();
    }
}
new ReviewReminderAction().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map