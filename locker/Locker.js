"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../common/utils");
class Locker {
    constructor(github, daysSinceClose, daysSinceUpdate, label, ignoreLabelUntil, labelUntil) {
        this.github = github;
        this.daysSinceClose = daysSinceClose;
        this.daysSinceUpdate = daysSinceUpdate;
        this.label = label;
        this.ignoreLabelUntil = ignoreLabelUntil;
        this.labelUntil = labelUntil;
    }
    async run() {
        const closedTimestamp = utils_1.daysAgoToHumanReadbleDate(this.daysSinceClose);
        const updatedTimestamp = utils_1.daysAgoToHumanReadbleDate(this.daysSinceUpdate);
        const query = `closed:<${closedTimestamp} updated:<${updatedTimestamp} is:unlocked` +
            (this.label ? ` -label:${this.label}` : '');
        for await (const page of this.github.query({ q: query })) {
            await Promise.all(page.map(async (issue) => {
                const hydrated = await issue.getIssue();
                if (!hydrated.locked &&
                    hydrated.open === false &&
                    (!this.label || !hydrated.labels.includes(this.label))
                // TODO: Verify closed and updated timestamps
                ) {
                    const skipDueToIgnoreLabel = this.ignoreLabelUntil &&
                        this.labelUntil &&
                        hydrated.labels.includes(this.ignoreLabelUntil) &&
                        !hydrated.labels.includes(this.labelUntil);
                    if (!skipDueToIgnoreLabel) {
                        utils_1.safeLog(`Locking issue ${hydrated.number}`);
                        await issue.lockIssue();
                    }
                    else {
                        utils_1.safeLog(`Not locking issue as it has ignoreLabelUntil but not labelUntil`);
                    }
                }
                else {
                    if (hydrated.locked) {
                        utils_1.safeLog(`Issue ${hydrated.number} is already locked. Ignoring`);
                    }
                    else {
                        utils_1.safeLog('Query returned an invalid issue:' + hydrated.number);
                    }
                }
            }));
        }
    }
}
exports.Locker = Locker;
//# sourceMappingURL=Locker.js.map