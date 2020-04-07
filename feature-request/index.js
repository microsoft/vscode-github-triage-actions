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
const FeatureRequest_1 = require("./FeatureRequest");
const main = async () => {
    if (github_1.context.eventName === 'repository_dispatch' && github_1.context.payload.action !== 'trigger_feature_request') {
        return;
    }
    const token = utils_1.getRequiredInput('token');
    const config = {
        milestones: {
            candidateID: +utils_1.getRequiredInput('candidateMilestoneID'),
            candidateName: utils_1.getRequiredInput('candidateMilestoneName'),
            backlogID: +utils_1.getRequiredInput('backlogMilestoneID'),
        },
        featureRequestLabel: utils_1.getRequiredInput('featureRequestLabel'),
        upvotesRequired: +utils_1.getRequiredInput('upvotesRequired'),
        numCommentsOverride: +utils_1.getRequiredInput('numCommentsOverride'),
        comments: {
            init: utils_1.getRequiredInput('initComment'),
            warn: utils_1.getRequiredInput('warnComment'),
            accept: utils_1.getRequiredInput('acceptComment'),
            reject: utils_1.getRequiredInput('rejectComment'),
        },
        delays: {
            warn: +utils_1.getRequiredInput('warnDays'),
            close: +utils_1.getRequiredInput('closeDays'),
        },
    };
    if (github_1.context.eventName === 'schedule' || github_1.context.eventName === 'repository_dispatch') {
        console.log('query triggered');
        await new FeatureRequest_1.FeatureRequestQueryer(new octokit_1.OctoKit(token, github_1.context.repo), config).run();
    }
    else if (github_1.context.eventName === 'issues') {
        if (github_1.context.payload.action === 'labeled' &&
            github_1.context.payload.label.name === config.featureRequestLabel) {
            await new FeatureRequest_1.FeatureRequestOnLabel(new octokit_1.OctoKitIssue(token, github_1.context.repo, { number: github_1.context.issue.number }), +utils_1.getRequiredInput('milestoneDelaySeconds'), config.milestones.candidateID, config.featureRequestLabel).run();
        }
        else if (github_1.context.payload.action === 'milestoned') {
            await new FeatureRequest_1.FeatureRequestOnMilestone(new octokit_1.OctoKitIssue(token, github_1.context.repo, { number: github_1.context.issue.number }), config.comments.init, config.milestones.candidateID).run();
        }
    }
};
main()
    .then(utils_1.logRateLimit)
    .catch(async (error) => {
    core.setFailed(error.message);
    await utils_1.logErrorToIssue(error, true);
});
