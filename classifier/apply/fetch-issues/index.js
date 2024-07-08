"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const Action_1 = require("../../../common/Action");
const utils_1 = require("../../../common/utils");
const blobStorage_1 = require("../../blobStorage");
const minToDay = 0.0007;
const from = (0, utils_1.daysAgoToHumanReadbleDate)(+(0, utils_1.getRequiredInput)('from') * minToDay);
const until = (0, utils_1.daysAgoToHumanReadbleDate)(+(0, utils_1.getRequiredInput)('until') * minToDay);
const blobContainer = (0, utils_1.getRequiredInput)('blobContainerName');
class FetchIssues extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'Clasifier/Apply/FetchIssues';
    }
    async onTriggered(github) {
        const query = `created:>${from} updated:<${until} is:open type:issue`;
        (0, utils_1.safeLog)(`Querying for issues: ${query}`);
        const data = [];
        for await (const page of github.query({ q: query })) {
            for (const issue of page) {
                const issueData = await issue.getIssue();
                const cleansed = (0, utils_1.normalizeIssue)(issueData);
                data.push({ number: issueData.number, contents: `${cleansed.title}\n\n${cleansed.body}` });
            }
        }
        (0, fs_1.writeFileSync)((0, path_1.join)(__dirname, '../issue_data.json'), JSON.stringify(data));
        await (0, blobStorage_1.downloadBlobFile)('area-model.pickle', blobContainer);
        await (0, blobStorage_1.downloadBlobFile)('area-model-config.json', blobContainer);
        await (0, blobStorage_1.downloadBlobFile)('assignee-model.pickle', blobContainer);
        await (0, blobStorage_1.downloadBlobFile)('assignee-model-config.json', blobContainer);
    }
}
new FetchIssues().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map