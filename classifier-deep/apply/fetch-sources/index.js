"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const utils_1 = require("../../../common/utils");
const Action_1 = require("../../../common/Action");
const child_process_1 = require("child_process");
const core_1 = require("@actions/core");
const blobStorage_1 = require("../../blobStorage");
const minToDay = 0.0007;
const fromInput = core_1.getInput('from') || undefined;
const from = fromInput ? utils_1.daysAgoToHumanReadbleDate(+fromInput * minToDay) : undefined;
const until = utils_1.daysAgoToHumanReadbleDate(+utils_1.getRequiredInput('until') * minToDay);
const createdQuery = `created:` + (from ? `${from}..${until}` : `<${until}`);
const blobContainer = utils_1.getRequiredInput('blobContainerName');
const blobStorageKey = utils_1.getRequiredInput('blobStorageKey');
class FetchIssues extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'Clasifier-Deep/Apply/FetchIssues';
    }
    async onTriggered(github) {
        var _a;
        const query = `${createdQuery} is:open no:assignee`;
        const data = [];
        for await (const page of github.query({ q: query })) {
            for (const issue of page) {
                const issueData = await issue.getIssue();
                let performedPRAssignment = false;
                if (issueData.isPr) {
                    try {
                        utils_1.safeLog('issue is a PR, attempting to read find a linked issue');
                        const linkedIssue = (_a = issueData.body.match(/#(\d{3,7})/)) === null || _a === void 0 ? void 0 : _a[1];
                        if (linkedIssue) {
                            utils_1.safeLog('PR is linked to', linkedIssue);
                            const linkedIssueData = await github.getIssueByNumber(+linkedIssue).getIssue();
                            const linkedIssueAssignee = linkedIssueData.assignees[0];
                            if (linkedIssueAssignee) {
                                utils_1.safeLog('linked issue is assigned to', linkedIssueAssignee);
                                await issue.addAssignee(linkedIssueAssignee);
                                performedPRAssignment = true;
                            }
                            else {
                                utils_1.safeLog('unable to find assignee for linked issue. falling back to normal classification');
                            }
                        }
                    }
                    catch (e) {
                        utils_1.safeLog('Encountered error finding linked issue assignee. Falling back to normal classification');
                    }
                }
                if (!performedPRAssignment) {
                    const cleansed = utils_1.normalizeIssue(issueData);
                    data.push({ number: issueData.number, contents: `${cleansed.title}\n\n${cleansed.body}` });
                }
            }
        }
        fs_1.writeFileSync(path_1.join(__dirname, '../issue_data.json'), JSON.stringify(data));
        const config = await github.readConfig(utils_1.getRequiredInput('configPath'));
        fs_1.writeFileSync(path_1.join(__dirname, '../configuration.json'), JSON.stringify(config));
        utils_1.safeLog('dowloading area model');
        await blobStorage_1.downloadBlobFile('area_model.zip', blobContainer, blobStorageKey);
        utils_1.safeLog('dowloading assignee model');
        await blobStorage_1.downloadBlobFile('assignee_model.zip', blobContainer, blobStorageKey);
        const classifierDeepRoot = path_1.join(__dirname, '..', '..');
        const blobStorage = path_1.join(classifierDeepRoot, 'blobStorage');
        const models = path_1.join(classifierDeepRoot, 'apply');
        utils_1.safeLog('unzipping area model');
        child_process_1.execSync(`unzip -q ${path_1.join(blobStorage, 'area_model.zip')} -d ${path_1.join(models, 'area_model')}`);
        utils_1.safeLog('unzipping assignee model');
        child_process_1.execSync(`unzip -q ${path_1.join(blobStorage, 'assignee_model.zip')} -d ${path_1.join(models, 'assignee_model')}`);
    }
}
new FetchIssues().run().catch((e) => core_1.setFailed(e.message));
//# sourceMappingURL=index.js.map