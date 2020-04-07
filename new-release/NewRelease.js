"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../utils/utils");
class NewRelease {
    constructor(github, label, labelColor, labelDescription, days) {
        this.github = github;
        this.label = label;
        this.labelColor = labelColor;
        this.labelDescription = labelDescription;
        this.days = days;
    }
    async run() {
        const release = await utils_1.loadLatestRelease('stable');
        if (!(release && release.timestamp))
            throw Error('Could not load latest release');
        const daysSinceRelease = (Date.now() - release.timestamp) / (24 * 60 * 60 * 1000);
        if (daysSinceRelease > this.days) {
            // delete the label from the repo as a whole to remove it from all issues
            console.log('New release window passed. Globally deleting label ' + this.label);
            return this.github.deleteLabel(this.label);
        }
        const issue = await this.github.getIssue();
        const cleansed = issue.body.replace(/<!-- .* -->/g, '');
        if (!/VS ?Code Version:.*Insider/i.test(cleansed) &&
            new RegExp(`VS ?Code Version:(.*[^\\d])?${release.productVersion.replace('.', '\\.')}([^\\d]|$)`, 'i').test(cleansed)) {
            if (!(await this.github.repoHasLabel(this.label))) {
                console.log('First release issue found. Globally creating label ' + this.label);
                await this.github.createLabel(this.label, this.labelColor, this.labelDescription);
            }
            console.log('New release issue found. Adding label ' + this.label);
            await this.github.addLabel(this.label);
        }
    }
}
exports.NewRelease = NewRelease;
