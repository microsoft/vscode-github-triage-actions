"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidtyChecker = void 0;
const utils_1 = require("../common/utils");
const keywords = [
    'money',
    'xbox',
    'temu',
    'instagram',
    'coupon',
    'fullclip',
    'fortnite',
    'tiktok',
    'tik-tok',
    'nintendo',
    'eshop',
    'discount codes',
    'v bucks',
    'v-bucks',
    'gift card',
    'giftcard',
    'movie',
    'viral',
    'cinema',
    'watch now',
];
class ValidtyChecker {
    constructor(github) {
        this.github = github;
    }
    async run() {
        const issue = await this.github.getIssue();
        if (!issue)
            return;
        (0, utils_1.safeLog)(`Checking issue validty for #${issue.number}...`);
        const hasKeyword = keywords.some((keyword) => issue.title.includes(keyword) || issue.body.includes(keyword));
        const isBadAuthor = issue.author.name === 'ghost';
        if (hasKeyword || isBadAuthor) {
            (0, utils_1.safeLog)(`Issue #${issue.number} is not a valid issue, closing...`);
            try {
                await this.github.addLabel('invalid');
                await this.github.closeIssue('not_planned');
                await this.github.lockIssue();
            }
            catch (e) {
                (0, utils_1.safeLog)(`Failed to close issue #${issue.number}: ${e}`);
            }
        }
    }
}
exports.ValidtyChecker = ValidtyChecker;
//# sourceMappingURL=ValidtyChecker.js.map