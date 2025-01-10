"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@actions/core");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
const Action_1 = require("../../../common/Action");
const utils_1 = require("../../../common/utils");
const blobStorage_1 = require("../../blobStorage");
const minToDay = 0.0007;
const fromInput = (0, core_1.getInput)('from') || undefined;
const excludeLabels = ((0, core_1.getInput)('excludeLabels') || '')
    .split('|')
    .map((l) => `-label:${l}`)
    .join(' ');
const from = fromInput ? (0, utils_1.daysAgoToHumanReadbleDate)(+fromInput * minToDay) : undefined;
const until = (0, utils_1.daysAgoToHumanReadbleDate)(+(0, utils_1.getRequiredInput)('until') * minToDay);
const createdQuery = `created:` + (from ? `${from}..${until}` : `<${until}`);
const blobContainer = (0, utils_1.getRequiredInput)('blobContainerName');
const repo = (0, utils_1.getRequiredInput)('repo');
const owner = (0, utils_1.getRequiredInput)('owner');
class FetchIssues extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'Clasifier-Deep/Apply/FetchIssues';
    }
    async onTriggered(github) {
        var _a;
        const query = `repo:${owner}/${repo} ${createdQuery} is:open no:assignee ${excludeLabels}`;
        const data = [];
        for await (const page of github.query({ q: query })) {
            for (const issue of page) {
                const issueData = await issue.getIssue();
                if (!issueData)
                    continue;
                // Probably spam. Tagged for later review
                if (issueData.author.name === 'ghost') {
                    (0, utils_1.safeLog)(`Tagging issue  #${issueData.number} as invalid`);
                    try {
                        await issue.addLabel('invalid');
                        await issue.closeIssue('not_planned');
                        await issue.lockIssue();
                    }
                    catch (e) {
                        (0, utils_1.safeLog)(`Failed to triage invalid issue #${issueData.number}: ${e}`);
                    }
                    continue;
                }
                let performedPRAssignment = false;
                let additionalInfo = '';
                if (issueData.isPr) {
                    if (await github.hasWriteAccess(issueData.author.name)) {
                        await issue.addAssignee(issueData.author.name);
                        performedPRAssignment = true;
                    }
                    else {
                        try {
                            (0, utils_1.safeLog)('issue is a PR, attempting to read find a linked issue');
                            const linkedIssue = (_a = issueData.body.match(/#(\d{3,7})/)) === null || _a === void 0 ? void 0 : _a[1];
                            if (linkedIssue) {
                                (0, utils_1.safeLog)('PR is linked to', linkedIssue);
                                const linkedIssueData = await github
                                    .getIssueByNumber(+linkedIssue)
                                    .getIssue();
                                if (!linkedIssueData)
                                    continue;
                                const normalized = (0, utils_1.normalizeIssue)(linkedIssueData);
                                additionalInfo = `\n\n${normalized.title}\n\n${normalized.body}`;
                                const linkedIssueAssignee = linkedIssueData.assignees[0];
                                if (linkedIssueAssignee) {
                                    (0, utils_1.safeLog)('linked issue is assigned to', linkedIssueAssignee);
                                    await issue.addAssignee(linkedIssueAssignee);
                                    performedPRAssignment = true;
                                }
                                else {
                                    (0, utils_1.safeLog)('unable to find assignee for linked issue. falling back to normal classification');
                                }
                            }
                        }
                        catch (e) {
                            (0, utils_1.safeLog)('Encountered error finding linked issue assignee. Falling back to normal classification');
                        }
                    }
                }
                if (!performedPRAssignment) {
                    const cleansed = (0, utils_1.normalizeIssue)(issueData);
                    data.push({
                        number: issueData.number,
                        contents: `${cleansed.title}\n\n${cleansed.body}` + additionalInfo,
                    });
                }
            }
        }
        (0, fs_1.writeFileSync)((0, path_1.join)(__dirname, '../issue_data.json'), JSON.stringify(data));
        const config = await github.readConfig((0, utils_1.getRequiredInput)('configPath'));
        (0, fs_1.writeFileSync)((0, path_1.join)(__dirname, '../configuration.json'), JSON.stringify(config));
        (0, utils_1.safeLog)('dowloading area model');
        await (0, blobStorage_1.downloadBlobFile)('area_model.zip', blobContainer);
        (0, utils_1.safeLog)('dowloading assignee model');
        await (0, blobStorage_1.downloadBlobFile)('assignee_model.zip', blobContainer);
        const classifierDeepRoot = (0, path_1.join)(__dirname, '..', '..');
        const blobStorage = (0, path_1.join)(classifierDeepRoot, 'blobStorage');
        const models = (0, path_1.join)(classifierDeepRoot, 'apply');
        (0, utils_1.safeLog)('unzipping area model');
        (0, child_process_1.execSync)(`unzip -q ${(0, path_1.join)(blobStorage, 'area_model.zip')} -d ${(0, path_1.join)(models, 'area_model')}`);
        (0, utils_1.safeLog)('unzipping assignee model');
        (0, child_process_1.execSync)(`unzip -q ${(0, path_1.join)(blobStorage, 'assignee_model.zip')} -d ${(0, path_1.join)(models, 'assignee_model')}`);
    }
}
new FetchIssues().run().catch((e) => (0, core_1.setFailed)(e.message));
//# sourceMappingURL=index.js.map