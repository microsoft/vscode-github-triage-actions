"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../common/utils");
const FeatureRequest_1 = require("./FeatureRequest");
const Action_1 = require("../common/Action");
const config = {
    milestones: {
        candidateID: +(0, utils_1.getRequiredInput)('candidateMilestoneID'),
        candidateName: (0, utils_1.getRequiredInput)('candidateMilestoneName'),
        backlogID: +(0, utils_1.getRequiredInput)('backlogMilestoneID'),
    },
    featureRequestLabel: (0, utils_1.getRequiredInput)('featureRequestLabel'),
    upvotesRequired: +(0, utils_1.getRequiredInput)('upvotesRequired'),
    numCommentsOverride: +(0, utils_1.getRequiredInput)('numCommentsOverride'),
    labelsToExclude: ((0, utils_1.getInput)('labelsToExclude') || '').split(',').filter((l) => !!l),
    comments: {
        init: (0, utils_1.getRequiredInput)('initComment'),
        warn: (0, utils_1.getRequiredInput)('warnComment'),
        accept: (0, utils_1.getRequiredInput)('acceptComment'),
        reject: (0, utils_1.getRequiredInput)('rejectComment'),
        rejectLabel: (0, utils_1.getInput)('rejectLabel'),
    },
    delays: {
        warn: +(0, utils_1.getRequiredInput)('warnDays'),
        close: +(0, utils_1.getRequiredInput)('closeDays'),
    },
};
class FeatureRequest extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'FeatureRequest';
    }
    async onTriggered(github) {
        await new FeatureRequest_1.FeatureRequestQueryer(github, config).run();
    }
    async onLabeled(github, label) {
        if (label === config.featureRequestLabel) {
            await new FeatureRequest_1.FeatureRequestOnLabel(github, +(0, utils_1.getRequiredInput)('milestoneDelaySeconds'), config.milestones.candidateID, config.featureRequestLabel).run();
        }
    }
    async onMilestoned(github) {
        await new FeatureRequest_1.FeatureRequestOnMilestone(github, config.comments.init, config.milestones.candidateID).run();
    }
}
new FeatureRequest().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map