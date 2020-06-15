"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const utils_1 = require("../../../common/utils");
const blobStorage_1 = require("../../blobStorage");
const Action_1 = require("../../../common/Action");
const child_process_1 = require("child_process");
const minToDay = 0.0007;
const from = utils_1.daysAgoToHumanReadbleDate(+utils_1.getRequiredInput('from') * minToDay);
const until = utils_1.daysAgoToHumanReadbleDate(+utils_1.getRequiredInput('until') * minToDay);
const blobContainer = utils_1.getRequiredInput('blobContainerName');
const blobStorageKey = utils_1.getRequiredInput('blobStorageKey');
class FetchIssues extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'Clasifier-Deep/Apply/FetchIssues';
    }
    async onTriggered(github) {
        const query = `created:>${from} updated:<${until} is:open`;
        const data = [];
        for await (const page of github.query({ q: query })) {
            for (const issue of page) {
                const issueData = await issue.getIssue();
                const cleansed = utils_1.normalizeIssue(issueData);
                data.push({ number: issueData.number, contents: `${cleansed.title}\n\n${cleansed.body}` });
            }
        }
        console.log('Got issues', JSON.stringify(data, null, 2));
        fs_1.writeFileSync(path_1.join(__dirname, '../issue_data.json'), JSON.stringify(data));
        const config = await github.readConfig(utils_1.getRequiredInput('configPath'));
        fs_1.writeFileSync(path_1.join(__dirname, '../configuration.json'), JSON.stringify(config));
        await blobStorage_1.downloadBlobFile('area_model.zip', blobContainer, blobStorageKey);
        await blobStorage_1.downloadBlobFile('assignee_model.zip', blobContainer, blobStorageKey);
        const classifierDeepRoot = path_1.join(__dirname, '..', '..');
        const blobStorage = path_1.join(classifierDeepRoot, 'blobStorage');
        const models = path_1.join(classifierDeepRoot, 'apply');
        child_process_1.execSync(`unzip -q ${path_1.join(blobStorage, 'area_model.zip')} -d ${(path_1.join(models), 'area_model')}`);
        child_process_1.execSync(`unzip -q ${path_1.join(blobStorage, 'assignee_model.zip')} -d ${(path_1.join(models), 'assignee_model')}`);
    }
}
new FetchIssues().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map