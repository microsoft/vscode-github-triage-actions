"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.Availability = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const octokit_1 = require("../../../api/octokit");
const vscodeTools_1 = require("../../../api/vscodeTools");
const Action_1 = require("../../../common/Action");
const utils_1 = require("../../../common/utils");
const allowLabels = ((0, utils_1.getInput)('allowLabels') || '').split('|');
const debug = !!(0, utils_1.getInput)('__debug');
const repo = (0, utils_1.getRequiredInput)('repo');
const owner = (0, utils_1.getRequiredInput)('owner');
// Do not modify.
// Copied from https://github.com/microsoft/vscode-tools/blob/91715fe00caab042b4aab5ed41d0402b0ae2393b/src/common/endgame.ts#L11-L16
var Availability;
(function (Availability) {
    Availability[Availability["FULL"] = 1] = "FULL";
    Availability[Availability["HALF"] = 2] = "HALF";
    Availability[Availability["OPTIONAL"] = 3] = "OPTIONAL";
    Availability[Availability["NOT_AVAILABLE"] = 4] = "NOT_AVAILABLE";
})(Availability = exports.Availability || (exports.Availability = {}));
class ApplyLabels extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'Classifier-Deep/Apply/ApplyLabels';
    }
    async onTriggered(github) {
        var _a;
        const config = await github.readConfig((0, utils_1.getRequiredInput)('configPath'));
        const token = await (0, Action_1.getAuthenticationToken)();
        const labelings = JSON.parse((0, fs_1.readFileSync)((0, path_1.join)(__dirname, '../issue_labels.json'), { encoding: 'utf8' }));
        for (const labeling of labelings) {
            const issue = new octokit_1.OctoKitIssue(token, { owner, repo }, { number: labeling.number });
            const potentialAssignees = [];
            const addAssignee = async (assignee) => {
                var _a;
                if ((_a = config.vacation) === null || _a === void 0 ? void 0 : _a.includes(assignee)) {
                    (0, utils_1.safeLog)('not assigning ', assignee, 'becuase they are on vacation');
                }
                else {
                    potentialAssignees.push(assignee);
                }
            };
            const issueData = await issue.getIssue();
            if (!issueData)
                continue;
            if (issueData.labels.includes('invalid')) {
                (0, utils_1.safeLog)(`issue ${labeling.number} is invalid, skipping`);
                continue;
            }
            if (issueData.number !== labeling.number) {
                (0, utils_1.safeLog)(`issue ${labeling.number} moved to ${issueData.number}, skipping`);
                continue;
            }
            const allLabelsAllowed = issueData.labels.every((issueLabel) => allowLabels.some((allowedLabel) => issueLabel.includes(allowedLabel)));
            if (!debug && (issueData.assignee || !allLabelsAllowed)) {
                (0, utils_1.safeLog)('skipping');
                continue;
            }
            (0, utils_1.safeLog)('not skipping', JSON.stringify({
                assignee: labeling.assignee,
                area: labeling.area,
                number: labeling.number,
            }));
            {
                const { category, confidence, confident } = labeling.area;
                if (debug) {
                    if (confident) {
                        if (!(await github.repoHasLabel(category))) {
                            (0, utils_1.safeLog)(`creating label`);
                            await github.createLabel(category, 'f1d9ff', '');
                        }
                        await issue.addLabel(category);
                    }
                    await issue.postComment(`confidence for label ${category}: ${confidence}. ${confident ? 'does' : 'does not'} meet threshold`);
                }
                if (confident) {
                    (0, utils_1.safeLog)(`assigning person based on label ${category} for issue ${issueData.number}`);
                    // Assign the issue to the proper person based on the label that was assigned
                    // This is configurable in the per repo config
                    const labelConfig = (_a = config.labels) === null || _a === void 0 ? void 0 : _a[category];
                    await Promise.all([
                        ...((labelConfig === null || labelConfig === void 0 ? void 0 : labelConfig.assign)
                            ? labelConfig.assign.map((assignee) => addAssignee(assignee))
                            : []),
                    ]);
                }
            }
            {
                const { category, confidence, confident } = labeling.assignee;
                if (debug) {
                    if (confident) {
                        if (!(await github.repoHasLabel(category))) {
                            (0, utils_1.safeLog)(`creating assignee label`);
                            await github.createLabel(category, 'ffa5a1', '');
                        }
                        await issue.addLabel(category);
                    }
                    await issue.postComment(`confidence for assignee ${category}: ${confidence}. ${confident ? 'does' : 'does not'} meet threshold`);
                }
                if (confident) {
                    (0, utils_1.safeLog)('has assignee');
                    await addAssignee(category);
                }
            }
            let performedAssignment = false;
            if (potentialAssignees.length && !debug) {
                for (const assignee of potentialAssignees) {
                    const hasBeenAssigned = await issue.getAssigner(assignee).catch(() => undefined);
                    if (!hasBeenAssigned) {
                        await issue.addAssignee(assignee);
                        performedAssignment = true;
                        break;
                    }
                }
            }
            if (!performedAssignment) {
                (0, utils_1.safeLog)('could not find assignee, picking a random one...');
                try {
                    const vscodeToolsAPI = new vscodeTools_1.VSCodeToolsAPIManager();
                    const triagers = await vscodeToolsAPI.getTriagerGitHubIds();
                    (0, utils_1.safeLog)('Acquired list of available triagers');
                    const available = triagers;
                    if (available) {
                        // Check if the issue has any cc'ed users and assign them if they are available
                        const issueBody = issueData.body;
                        const ccMatches = (issueBody.match(/@(\w+)/g) || []).map((match) => match.replace('@', ''));
                        for (const ccMatch of ccMatches) {
                            if (available.includes(ccMatch)) {
                                (0, utils_1.safeLog)("assigning cc'ed user", ccMatch);
                                await issue.addAssignee(ccMatch);
                                performedAssignment = true;
                            }
                        }
                        if (performedAssignment) {
                            continue;
                        }
                        // Shuffle the array
                        for (let i = available.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [available[i], available[j]] = [available[j], available[i]];
                        }
                        if (!debug) {
                            await issue.addLabel('triage-needed');
                            let i = 0;
                            const randomSelection = available[i];
                            (0, utils_1.safeLog)('assigning', randomSelection);
                            await issue.addAssignee(randomSelection);
                            const staleIssues = github.query({
                                q: `is:issue is:open label:triage-needed -label:stale -label:info-needed updated:<${(0, utils_1.daysAgoToHumanReadbleDate)(7)}`,
                            });
                            // Loop through assigning new people to issues which are over a week old and not triaged
                            for await (const page of staleIssues) {
                                for (const issue of page) {
                                    i += 1;
                                    if (i >= available.length) {
                                        i = 0;
                                    }
                                    (0, utils_1.safeLog)('assigning to stale issue', available[i]);
                                    await issue.addAssignee(available[i]);
                                    await issue.addLabel('stale');
                                }
                            }
                        }
                    }
                    else {
                        (0, utils_1.safeLog)('could not find manifest');
                    }
                }
                catch (e) {
                    (0, utils_1.safeLog)('error assigning random', e.message);
                }
            }
        }
    }
}
new ApplyLabels().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map