"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const github_1 = require("@actions/github");
const utils_1 = require("../../../common/utils");
const fs_1 = require("fs");
const path_1 = require("path");
const Action_1 = require("../../../common/Action");
const child_process_1 = require("child_process");
const blobStorage_1 = require("../../blobStorage");
const download_1 = require("./download");
const token = utils_1.getRequiredInput('token');
const endCursor = utils_1.getInput('cursor');
const blobContainer = utils_1.getRequiredInput('blobContainerName');
const blobStorageKey = utils_1.getRequiredInput('blobStorageKey');
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
        child_process_1.execSync(`zip -q ${path_1.join(__dirname, '..', '..', 'blobStorage', 'issues.json.zip')} ${path_1.join(__dirname, 'issues.json')}`);
        await blobStorage_1.uploadBlobFile('issues.json.zip', blobContainer, blobStorageKey);
    }
}
new FetchIssues().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map