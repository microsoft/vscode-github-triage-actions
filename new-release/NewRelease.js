"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewRelease = void 0;
const utils_1 = require("../common/utils");
class NewRelease {
    constructor(github, label, labelColor, labelDescription, days, oldVersionMessage) {
        this.github = github;
        this.label = label;
        this.labelColor = labelColor;
        this.labelDescription = labelDescription;
        this.days = days;
        this.oldVersionMessage = oldVersionMessage;
    }
    async run() {
        const release = await (0, utils_1.loadLatestRelease)('stable');
        if (!(release && release.timestamp))
            throw Error('Could not load latest release');
        const daysSinceRelease = (Date.now() - release.timestamp) / (24 * 60 * 60 * 1000);
        const issue = await this.github.getIssue();
        if (!issue)
            return;
        const cleansed = issue.body.replace(/<!-- .* -->/g, '');
        const productVersion = release.productVersion.endsWith('.0')
            ? release.productVersion.replace(/\.0$/, '')
            : release.productVersion;
        if (this.oldVersionMessage &&
            !/insider/i.test(cleansed) &&
            !/\.dev/i.test(cleansed) &&
            /VS ?Code Version:.*\d/i.test(cleansed) &&
            !cleansed.includes(productVersion)) {
            await this.github.postComment(this.oldVersionMessage.replace('{currentVersion}', release.productVersion));
            return;
        }
        if (daysSinceRelease > this.days) {
            // delete the label from the repo as a whole to remove it from all issues
            (0, utils_1.safeLog)('New release window passed. Globally deleting label ' + this.label);
            return this.github.deleteLabel(this.label);
        }
        if (!/VS ?Code Version:.*Insider/i.test(cleansed) &&
            new RegExp(`VS ?Code Version:(.*[^\\d])?${productVersion.replace('.', '\\.')}([^\\d]|$)`, 'i').test(cleansed)) {
            if (!(await this.github.repoHasLabel(this.label))) {
                (0, utils_1.safeLog)('First release issue found. Globally creating label ' + this.label);
                await this.github.createLabel(this.label, this.labelColor, this.labelDescription);
            }
            (0, utils_1.safeLog)('New release issue found. Adding label ' + this.label);
            await this.github.addLabel(this.label);
        }
    }
}
exports.NewRelease = NewRelease;
//# sourceMappingURL=NewRelease.js.map