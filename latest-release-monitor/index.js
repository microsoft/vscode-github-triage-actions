"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const octokit_1 = require("../api/octokit");
const blobStorage_1 = require("../classifier/blobStorage");
const Action_1 = require("../common/Action");
const utils_1 = require("../common/utils");
class LatestReleaseMonitor extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'LatestReleaseMonitor';
    }
    async update(quality) {
        var _a;
        let lastKnown = undefined;
        try {
            lastKnown = await (0, blobStorage_1.downloadBlobText)('latest-' + quality, 'latest-releases');
        }
        catch {
            // pass
        }
        const latest = (_a = (await (0, utils_1.loadLatestRelease)(quality))) === null || _a === void 0 ? void 0 : _a.version;
        if (latest && latest !== lastKnown) {
            (0, utils_1.safeLog)('found a new release of', quality);
            const owner = 'microsoft';
            const repo = 'vscode-engineering';
            const token = await this.getToken();
            await (0, blobStorage_1.uploadBlobText)('latest-' + quality, latest, 'latest-releases');
            await new octokit_1.OctoKit(token, { owner, repo }).dispatch('released-' + quality);
        }
    }
    async onTriggered() {
        await this.update('insider');
        await this.update('stable');
    }
}
new LatestReleaseMonitor().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map