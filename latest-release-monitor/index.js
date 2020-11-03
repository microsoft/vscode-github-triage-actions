"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const github_1 = require("@actions/github");
const utils_1 = require("../common/utils");
const blobStorage_1 = require("../classifier/blobStorage");
const octokit_1 = require("../api/octokit");
const Action_1 = require("../common/Action");
const token = utils_1.getRequiredInput('token');
const storageKey = utils_1.getRequiredInput('storageKey');
class LatestReleaseMonitor extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'LatestReleaseMonitor';
    }
    async update(quality) {
        var _a;
        let lastKnown = undefined;
        try {
            lastKnown = await blobStorage_1.downloadBlobText('latest-' + quality, 'latest-releases', storageKey);
        }
        catch {
            // pass
        }
        const latest = (_a = (await utils_1.loadLatestRelease(quality))) === null || _a === void 0 ? void 0 : _a.version;
        if (latest && latest !== lastKnown) {
            utils_1.safeLog('found a new release of', quality);
            await blobStorage_1.uploadBlobText('latest-' + quality, latest, 'latest-releases', storageKey);
            await new octokit_1.OctoKit(token, github_1.context.repo).dispatch('released-' + quality);
        }
    }
    async onTriggered() {
        await this.update('insider');
        await this.update('stable');
    }
}
new LatestReleaseMonitor().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map