"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../common/utils");
class AddExtraLabel {
    constructor(github, newLabel) {
        this.github = github;
        this.newLabel = newLabel;
    }
    async run() {
        const issue = await this.github.getIssue();
        utils_1.safeLog(`Adding extra label \`${this.newLabel}\` to issue \`${issue.number}\``);
        await this.github.addLabel(this.newLabel);
    }
}
exports.AddExtraLabel = AddExtraLabel;
//# sourceMappingURL=addExtraLabel.js.map