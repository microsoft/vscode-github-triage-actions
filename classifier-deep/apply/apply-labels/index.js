"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const github_1 = require("@actions/github");
const octokit_1 = require("../../../api/octokit");
const utils_1 = require("../../../common/utils");
const Action_1 = require("../../../common/Action");
const telemetry_1 = require("../../../common/telemetry");
const token = utils_1.getRequiredInput('token');
const allowLabels = (utils_1.getInput('allowLabels') || '').split('|');
const debug = !!utils_1.getInput('__debug');
class ApplyLabels extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'Classifier-Deep/Apply/ApplyLabels';
    }
    async onTriggered(github) {
        var _a, _b;
        const config = await github.readConfig(utils_1.getRequiredInput('configPath'));
        const labelings = JSON.parse(fs_1.readFileSync(path_1.join(__dirname, '../issue_labels.json'), { encoding: 'utf8' }));
        console.log('labelings:', labelings);
        for (const labeling of labelings) {
            const issue = new octokit_1.OctoKitIssue(token, github_1.context.repo, { number: labeling.number });
            let hasAssigned = false;
            const addAssignee = async (assignee) => {
                var _a;
                if ((_a = config.vacation) === null || _a === void 0 ? void 0 : _a.includes(assignee)) {
                    console.log('not assigning ', assignee, 'becuase they are on vacation');
                }
                else if (!hasAssigned) {
                    await issue.addAssignee(assignee);
                    hasAssigned = true;
                }
                else {
                    console.log('not assigning ', assignee, 'becuase someone has already been assigned');
                }
            };
            const issueData = await issue.getIssue();
            if (!debug &&
                (issueData.assignee || issueData.labels.some((label) => !allowLabels.includes(label)))) {
                console.log('skipping');
                continue;
            }
            console.log('not skipping', {
                assignee: labeling.assignee,
                area: labeling.area,
                number: labeling.number,
            });
            {
                const { category, confidence, confident } = labeling.area;
                if (debug) {
                    if (confident) {
                        if (!(await github.repoHasLabel(category))) {
                            console.log(`creating label`);
                            await github.createLabel(category, 'f1d9ff', '');
                        }
                        await issue.addLabel(category);
                    }
                    await issue.postComment(`confidence for label ${category}: ${confidence}. ${confident ? 'does' : 'does not'} meet threshold`);
                }
                if (confident) {
                    console.log(`adding label ${category} to issue ${issueData.number}`);
                    const labelConfig = (_a = config.labels) === null || _a === void 0 ? void 0 : _a[category];
                    await Promise.all([
                        ...((labelConfig === null || labelConfig === void 0 ? void 0 : labelConfig.assign) ? labelConfig.assign.map((assignee) => addAssignee(assignee))
                            : []),
                    ]);
                    await telemetry_1.trackEvent(issue, 'classification:performed', {
                        label: labeling.area.category,
                    });
                }
            }
            {
                const { category, confidence, confident } = labeling.assignee;
                if (debug) {
                    if (confident) {
                        if (!(await github.repoHasLabel(category))) {
                            console.log(`creating assignee label`);
                            await github.createLabel(category, 'ffa5a1', '');
                        }
                        await issue.addLabel(category);
                    }
                    await issue.postComment(`confidence for assignee ${category}: ${confidence}. ${confident ? 'does' : 'does not'} meet threshold`);
                }
                if (confident) {
                    console.log('has assignee');
                    const assigneeConfig = (_b = config.assignees) === null || _b === void 0 ? void 0 : _b[category];
                    console.log({ assigneeConfig });
                    await addAssignee(category);
                    await telemetry_1.trackEvent(issue, 'classification:performed', {
                        assignee: labeling.assignee.category,
                    });
                }
            }
        }
    }
}
new ApplyLabels().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map