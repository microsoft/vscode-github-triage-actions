"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const core = require("@actions/core");
const github_1 = require("@actions/github");
const utils_1 = require("../../../utils/utils");
const download_1 = require("./download");
const createDataDir_1 = require("./createDataDir");
const fs_1 = require("fs");
const path_1 = require("path");
const token = utils_1.getRequiredInput('token');
const run = async () => {
    try {
        fs_1.statSync(path_1.join(__dirname, 'issues.json')).isFile();
    }
    catch {
        await download_1.download(token, github_1.context.repo);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await createDataDir_1.createDataDirectories('category');
};
run().catch(async (error) => {
    core.setFailed(error.message);
    await utils_1.logErrorToIssue(error, true, token);
});
//# sourceMappingURL=index.js.map