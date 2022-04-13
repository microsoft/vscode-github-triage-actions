"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../common/utils");
const Action_1 = require("../common/Action");
class SubscribeRunner extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'Subscribe';
    }
    async onLabeled(issue, label) {
        const subscribe = await issue.readConfig((0, utils_1.getRequiredInput)('config-path'));
        const config = subscribe === null || subscribe === void 0 ? void 0 : subscribe[label];
        const prefix = `Pinging \`${label}\` topic followers: `;
        if (config) {
            for await (const page of issue.getComments()) {
                if (page.some((comment) => comment.body.includes(prefix))) {
                    return;
                }
            }
            await issue.postComment(prefix + config.map((name) => `@${name}`).join(' '));
        }
    }
}
new SubscribeRunner().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map