"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../common/utils");
class CopyCat {
    constructor(github, owner, repo) {
        this.github = github;
        this.owner = owner;
        this.repo = repo;
    }
    async run() {
        var _a;
        const issue = await this.github.getIssue();
        utils_1.safeLog(`Mirroring issue \`${issue.number}\` to ${this.owner}/${this.repo}`);
        await this.github.createIssue(this.owner, this.repo, issue.title, ((_a = issue.body) !== null && _a !== void 0 ? _a : '').replace(/@|#|issues/g, '-').replace(/\/github.com\//g, '/github-com/'));
    }
}
exports.CopyCat = CopyCat;
//# sourceMappingURL=CopyCat.js.map