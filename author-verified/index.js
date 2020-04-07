"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const core = require("@actions/core");
const github_1 = require("@actions/github");
const octokit_1 = require("../api/octokit");
const utils_1 = require("../utils/utils");
const AuthorVerified_1 = require("./AuthorVerified");
const main = async () => {
    if (github_1.context.eventName === 'repository_dispatch' && github_1.context.payload.action !== 'trigger_author_verified') {
        return;
    }
    const token = utils_1.getRequiredInput('token');
    const requestVerificationComment = utils_1.getRequiredInput('requestVerificationComment');
    const pendingReleaseLabel = utils_1.getRequiredInput('pendingReleaseLabel');
    const authorVerificationRequestedLabel = utils_1.getRequiredInput('authorVerificationRequestedLabel');
    if (github_1.context.eventName === 'schedule' || github_1.context.eventName === 'repository_dispatch') {
        await new AuthorVerified_1.AuthorVerifiedQueryer(new octokit_1.OctoKit(token, github_1.context.repo), requestVerificationComment, pendingReleaseLabel, authorVerificationRequestedLabel).run();
    }
    else if (github_1.context.eventName === 'issues') {
        if (github_1.context.payload.action === 'closed' ||
            github_1.context.payload.label.name === authorVerificationRequestedLabel) {
            await new AuthorVerified_1.AuthorVerifiedLabeler(new octokit_1.OctoKitIssue(token, github_1.context.repo, { number: github_1.context.issue.number }), requestVerificationComment, pendingReleaseLabel, authorVerificationRequestedLabel).run();
        }
    }
};
main()
    .then(utils_1.logRateLimit)
    .catch(async (error) => {
    core.setFailed(error.message);
    await utils_1.logErrorToIssue(error.message, true);
});
