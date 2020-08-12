"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../common/utils");
const AuthorVerified_1 = require("./AuthorVerified");
const Action_1 = require("../common/Action");
const requestVerificationComment = utils_1.getRequiredInput('requestVerificationComment');
const pendingReleaseLabel = utils_1.getRequiredInput('pendingReleaseLabel');
const verifiedLabel = utils_1.getRequiredInput('verifiedLabel');
const authorVerificationRequestedLabel = utils_1.getRequiredInput('authorVerificationRequestedLabel');
class AuthorVerified extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'AuthorVerified';
    }
    async onTriggered(octokit) {
        return new AuthorVerified_1.AuthorVerifiedQueryer(octokit, requestVerificationComment, pendingReleaseLabel, authorVerificationRequestedLabel, verifiedLabel).run();
    }
    runLabler(issue) {
        return new AuthorVerified_1.AuthorVerifiedLabeler(issue, requestVerificationComment, pendingReleaseLabel, authorVerificationRequestedLabel, verifiedLabel).run();
    }
    async onClosed(issue) {
        await this.runLabler(issue);
    }
    async onLabeled(issue, label) {
        if (label === authorVerificationRequestedLabel) {
            await this.runLabler(issue);
        }
    }
}
new AuthorVerified().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map