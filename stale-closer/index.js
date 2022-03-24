"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../common/utils");
const FeatureRequest_1 = require("../feature-request/FeatureRequest");
const Action_1 = require("../common/Action");
const config = {
    milestones: {
        candidateID: +utils_1.getRequiredInput('candidateMilestoneID'),
        candidateName: utils_1.getRequiredInput('candidateMilestoneName'),
    },
    featureRequestLabel: utils_1.getRequiredInput('featureRequestLabel'),
    upvotesRequired: +utils_1.getRequiredInput('upvotesRequired'),
    numCommentsOverride: +utils_1.getRequiredInput('numCommentsOverride'),
    labelsToExclude: (utils_1.getInput('labelsToExclude') || '').split(',').filter((l) => !!l),
    comments: {
        init: utils_1.getRequiredInput('initComment'),
        warn: utils_1.getRequiredInput('warnComment'),
        reject: utils_1.getRequiredInput('rejectComment'),
        rejectLabel: utils_1.getInput('rejectLabel'),
    },
    delays: {
        warn: +utils_1.getRequiredInput('warnDays'),
        close: +utils_1.getRequiredInput('closeDays'),
    },
};
class StaleCloser extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'StaleCloser';
    }
    async onTriggered(github) {
        await new FeatureRequest_1.FeatureRequestQueryer(github, config).run();
    }
    async onLabeled(github, label) {
        if (label === config.featureRequestLabel) {
            await new FeatureRequest_1.FeatureRequestOnLabel(github, +utils_1.getRequiredInput('milestoneDelaySeconds'), config.milestones.candidateID, config.featureRequestLabel).run();
        }
    }
    async onMilestoned(github) {
        await new FeatureRequest_1.FeatureRequestOnMilestone(github, config.comments.init, config.milestones.candidateID).run();
    }
}
new StaleCloser().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map