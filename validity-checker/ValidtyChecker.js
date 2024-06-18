"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidtyChecker = void 0;
const utils_1 = require("../common/utils");
const keywords = ['money', 'xbox', 'tiktok', 'tik-tok'];
class ValidtyChecker {
    constructor(github) {
        this.github = github;
    }
    async run() {
        const issue = await this.github.getIssue();
        (0, utils_1.safeLog)(`Checking issue validty for #${issue.number}...`);
        const hasKeyword = keywords.some((keyword) => issue.title.includes(keyword) || issue.body.includes(keyword));
        if (hasKeyword) {
            (0, utils_1.safeLog)(`Issue #${issue.number} is not a valid issue, closing...`);
            try {
                await this.github.closeIssue('not_planned');
            }
            catch (e) {
                (0, utils_1.safeLog)(`Failed to close issue #${issue.number}: ${e}`);
            }
        }
    }
}
exports.ValidtyChecker = ValidtyChecker;
//# sourceMappingURL=ValidtyChecker.js.map