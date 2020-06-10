"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const github_1 = require("@actions/github");
const utils_1 = require("../../../common/utils");
const download_1 = require("./download");
const createDataDir_1 = require("./createDataDir");
const fs_1 = require("fs");
const path_1 = require("path");
const Action_1 = require("../../../common/Action");
const token = utils_1.getRequiredInput('token');
const endCursor = utils_1.getInput('cursor');
const areas = utils_1.getRequiredInput('areas').split('|');
const assignees = utils_1.getRequiredInput('assignees').split('|');
class FetchIssues extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'Classifier/Train/FetchIssues';
    }
    async onTriggered() {
        if (endCursor) {
            await download_1.download(token, github_1.context.repo, endCursor);
        }
        else {
            try {
                fs_1.statSync(path_1.join(__dirname, 'issues.json')).isFile();
            }
            catch {
                await download_1.download(token, github_1.context.repo);
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await createDataDir_1.createDataDirectories(areas, assignees);
    }
}
new FetchIssues().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map