"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../utils/utils");
class ReleasePipelineQueryer {
    constructor(github, notYetReleasedLabel, insidersReleasedLabel) {
        this.github = github;
        this.notYetReleasedLabel = notYetReleasedLabel;
        this.insidersReleasedLabel = insidersReleasedLabel;
    }
    async run() {
        const query = `is:closed label:${this.notYetReleasedLabel}`;
        for await (const page of this.github.query({ q: query })) {
            for (const issue of page) {
                const issueData = await issue.getIssue();
                if (issueData.labels.includes(this.notYetReleasedLabel) && issueData.open === false) {
                    await new ReleasePipelineLabeler(issue, this.notYetReleasedLabel, this.insidersReleasedLabel).run();
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }
                else {
                    console.log('Query returned an invalid issue:' +
                        JSON.stringify({ ...issueData, body: 'stripped' }));
                }
            }
        }
    }
}
exports.ReleasePipelineQueryer = ReleasePipelineQueryer;
class ReleasePipelineLabeler {
    constructor(github, notYetReleasedLabel, insidersReleasedLabel) {
        this.github = github;
        this.notYetReleasedLabel = notYetReleasedLabel;
        this.insidersReleasedLabel = insidersReleasedLabel;
    }
    async run() {
        var _a;
        const latestRelease = await utils_1.loadLatestRelease('insider');
        if (!latestRelease)
            throw Error('Error loading latest release');
        const closingHash = (_a = (await this.github.getClosingInfo())) === null || _a === void 0 ? void 0 : _a.hash;
        if (!closingHash)
            throw Error('Error loading closing info');
        let releaseContainsCommit = await this.github.releaseContainsCommit(latestRelease.version, closingHash);
        if (releaseContainsCommit === 'yes') {
            await this.github.removeLabel(this.notYetReleasedLabel);
            await this.github.addLabel(this.insidersReleasedLabel);
        }
        else if (releaseContainsCommit === 'no') {
            await this.github.addLabel(this.notYetReleasedLabel);
        }
    }
}
exports.ReleasePipelineLabeler = ReleasePipelineLabeler;
//# sourceMappingURL=ReleasePipeline.js.map