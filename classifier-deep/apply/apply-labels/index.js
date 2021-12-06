"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const mongodb = require("mongodb");
const fs_1 = require("fs");
const path_1 = require("path");
const github_1 = require("@actions/github");
const octokit_1 = require("../../../api/octokit");
const utils_1 = require("../../../common/utils");
const Action_1 = require("../../../common/Action");
const telemetry_1 = require("../../../common/telemetry");
const token = utils_1.getRequiredInput('token');
const manifestDbConnectionString = utils_1.getInput('manifestDbConnectionString');
const allowLabels = (utils_1.getInput('allowLabels') || '').split('|');
const debug = !!utils_1.getInput('__debug');
class ApplyLabels extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'Classifier-Deep/Apply/ApplyLabels';
    }
    async onTriggered(github) {
        var _a;
        let manifest = Promise.resolve(undefined);
        if (manifestDbConnectionString) {
            utils_1.safeLog('has manifestDbConnectionString');
            manifest = mongodb.MongoClient.connect(manifestDbConnectionString).then(async (db) => {
                utils_1.safeLog('connected to db');
                try {
                    const collection = db.collection('testers');
                    const triagers = await collection.find().toArray();
                    return triagers.filter((t) => t.triager).map((t) => t.id);
                }
                catch (e) {
                    utils_1.safeLog('error reading from db');
                    utils_1.safeLog(e.message);
                }
                finally {
                    utils_1.safeLog('disconnected from db');
                    db.close();
                }
            });
        }
        else {
            utils_1.safeLog('has no manifestDbConnectionString');
        }
        const config = await github.readConfig(utils_1.getRequiredInput('configPath'));
        const labelings = JSON.parse(fs_1.readFileSync(path_1.join(__dirname, '../issue_labels.json'), { encoding: 'utf8' }));
        for (const labeling of labelings) {
            const issue = new octokit_1.OctoKitIssue(token, github_1.context.repo, { number: labeling.number });
            const potentialAssignees = [];
            const addAssignee = async (assignee) => {
                var _a;
                if ((_a = config.vacation) === null || _a === void 0 ? void 0 : _a.includes(assignee)) {
                    utils_1.safeLog('not assigning ', assignee, 'becuase they are on vacation');
                }
                else {
                    potentialAssignees.push(assignee);
                }
            };
            const issueData = await issue.getIssue();
            if (issueData.number !== labeling.number) {
                utils_1.safeLog(`issue ${labeling.number} moved to ${issueData.number}, skipping`);
                continue;
            }
            if (!debug &&
                (issueData.assignee || issueData.labels.some((label) => !allowLabels.includes(label)))) {
                utils_1.safeLog('skipping');
                continue;
            }
            utils_1.safeLog('not skipping', JSON.stringify({
                assignee: labeling.assignee,
                area: labeling.area,
                number: labeling.number,
            }));
            {
                const { category, confidence, confident } = labeling.area;
                if (debug) {
                    if (confident) {
                        if (!(await github.repoHasLabel(category))) {
                            utils_1.safeLog(`creating label`);
                            await github.createLabel(category, 'f1d9ff', '');
                        }
                        await issue.addLabel(category);
                    }
                    await issue.postComment(`confidence for label ${category}: ${confidence}. ${confident ? 'does' : 'does not'} meet threshold`);
                }
                if (confident) {
                    utils_1.safeLog(`adding label ${category} to issue ${issueData.number}`);
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
                            utils_1.safeLog(`creating assignee label`);
                            await github.createLabel(category, 'ffa5a1', '');
                        }
                        await issue.addLabel(category);
                    }
                    await issue.postComment(`confidence for assignee ${category}: ${confidence}. ${confident ? 'does' : 'does not'} meet threshold`);
                }
                if (confident) {
                    utils_1.safeLog('has assignee');
                    await addAssignee(category);
                    await telemetry_1.trackEvent(issue, 'classification:performed', {
                        assignee: labeling.assignee.category,
                    });
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
                utils_1.safeLog('could not find assignee, picking a random one...');
                try {
                    const available = await manifest;
                    if (available) {
                        const randomSelection = available[Math.floor(Math.random() * available.length)];
                        utils_1.safeLog('assigning', randomSelection);
                        await issue.addAssignee(randomSelection);
                    }
                    else {
                        utils_1.safeLog('could not find manifest');
                    }
                }
                catch (e) {
                    utils_1.safeLog('error assigning random', e.message);
                }
            }
        }
    }
}
new ApplyLabels().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map