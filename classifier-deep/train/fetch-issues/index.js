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
const token = (0, utils_1.getRequiredInput)('token');
const endCursor = (0, utils_1.getInput)('cursor');
const blobContainer = (0, utils_1.getRequiredInput)('blobContainerName');
const blobStorageKey = (0, utils_1.getRequiredInput)('blobStorageKey');
class FetchIssues extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'Classifier/Train/FetchIssues';
    }
    async onTriggered() {
        try {
            if (endCursor) {
                await (0, download_1.download)(token, github_1.context.repo, endCursor);
            }
            else {
                try {
                    (0, fs_1.statSync)((0, path_1.join)(__dirname, 'issues.json')).isFile();
                }
                catch {
                    await (0, download_1.download)(token, github_1.context.repo);
                }
            }
        }
        catch (err) {
            if (err && 'message' in err && /'AxiosError: Request failed with status code 502'/i.test(err.message)) {
                // Log error but don't fail the action, upload what we have
                console.error(err);
            }
            else {
                throw err;
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
        (0, child_process_1.execSync)(`zip -q ${(0, path_1.join)(__dirname, '..', '..', 'blobStorage', 'issues.json.zip')} ${(0, path_1.join)(__dirname, 'issues.json')}`);
        await (0, blobStorage_1.uploadBlobFile)('issues.json.zip', blobContainer, blobStorageKey);
    }
}
new FetchIssues().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map