"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.Locker = void 0;
const utils_1 = require("../common/utils");
class Locker {
    constructor(github, daysSinceClose, daysSinceUpdate, label, ignoreLabelUntil, ignoredMilestones, labelUntil, typeIs) {
        this.github = github;
        this.daysSinceClose = daysSinceClose;
        this.daysSinceUpdate = daysSinceUpdate;
        this.label = label;
        this.ignoreLabelUntil = ignoreLabelUntil;
        this.ignoredMilestones = ignoredMilestones;
        this.labelUntil = labelUntil;
        this.typeIs = typeIs;
    }
    async run() {
        const closedTimestamp = (0, utils_1.daysAgoToHumanReadbleDate)(this.daysSinceClose);
        const updatedTimestamp = (0, utils_1.daysAgoToHumanReadbleDate)(this.daysSinceUpdate);
        const milestones = this.ignoredMilestones ? this.ignoredMilestones.split(',') : [];
        const milestonesQuery = milestones.map((milestone) => ` -milestone:"${milestone}"`).join('');
        const query = `repo:${this.github.repoOwner}/${this.github.repoName} closed:<${closedTimestamp} updated:<${updatedTimestamp} is:unlocked` +
            (this.label ? ` -label:${this.label}` : '') +
            (milestones.length > 0 ? milestonesQuery : '') +
            (this.typeIs ? ` is:${this.typeIs}` : '');
        for await (const page of this.github.query({ q: query, per_page: 50 })) {
            page.map(async (issue) => {
                const hydrated = await issue.getIssue();
                if (!hydrated)
                    return;
                if (!hydrated.locked &&
                    hydrated.open === false &&
                    (!this.label || !hydrated.labels.includes(this.label)) &&
                    (!this.typeIs ||
                        (this.typeIs == 'issue' && !hydrated.isPr) ||
                        (this.typeIs == 'pr' && hydrated.isPr)) &&
                    (!this.ignoredMilestones ||
                        !hydrated.milestone ||
                        !milestones.includes(hydrated.milestone.title))
                // TODO: Verify closed and updated timestamps
                ) {
                    const skipDueToIgnoreLabel = this.ignoreLabelUntil &&
                        this.labelUntil &&
                        hydrated.labels.includes(this.ignoreLabelUntil) &&
                        !hydrated.labels.includes(this.labelUntil);
                    if (!skipDueToIgnoreLabel) {
                        (0, utils_1.safeLog)(`Locking issue ${hydrated.number}`);
                        try {
                            await issue.lockIssue();
                        }
                        catch (e) {
                            (0, utils_1.safeLog)(`Failed to lock issue ${hydrated.number}`);
                            const err = e;
                            (0, utils_1.safeLog)((err === null || err === void 0 ? void 0 : err.stack) || (err === null || err === void 0 ? void 0 : err.message) || String(e));
                        }
                    }
                    else {
                        (0, utils_1.safeLog)(`Not locking issue as it has ignoreLabelUntil but not labelUntil`);
                    }
                }
                else {
                    if (hydrated.locked) {
                        (0, utils_1.safeLog)(`Issue ${hydrated.number} is already locked. Ignoring`);
                    }
                    else {
                        (0, utils_1.safeLog)('Query returned an invalid issue:' + hydrated.number);
                    }
                }
            });
        }
    }
}
exports.Locker = Locker;
//# sourceMappingURL=Locker.js.map