"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegexFlagger = void 0;
const utils_1 = require("../common/utils");
class RegexFlagger {
    constructor(github, label, comment, mustMatch, mustNotMatch) {
        this.github = github;
        this.label = label;
        this.comment = comment;
        this.mustMatch = mustMatch;
        this.mustNotMatch = mustNotMatch;
    }
    async run() {
        const issue = await this.github.getIssue();
        if (!issue)
            return;
        const stripped = issue.body.replace(/<!--.*?-->/g, '');
        if ((this.mustNotMatch && new RegExp(this.mustNotMatch, 'i').test(stripped)) ||
            (this.mustMatch && !new RegExp(this.mustMatch, 'i').test(stripped))) {
            (0, utils_1.safeLog)('Flagging');
            if (this.label) {
                await this.github.addLabel(this.label);
            }
            if (this.comment) {
                await this.github.postComment(this.comment);
            }
            await this.github.closeIssue('not_planned');
        }
    }
}
exports.RegexFlagger = RegexFlagger;
//# sourceMappingURL=RegexLabeler.js.map