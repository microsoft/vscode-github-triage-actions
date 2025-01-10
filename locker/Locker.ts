/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GitHub } from '../api/api';
import { daysAgoToHumanReadbleDate, safeLog } from '../common/utils';

export class Locker {
	constructor(
		private github: GitHub,
		private daysSinceClose: number,
		private daysSinceUpdate: number,
		private label?: string,
		private ignoreLabelUntil?: string,
		private ignoredMilestones?: string,
		private labelUntil?: string,
		private typeIs?: string,
	) {}

	async run() {
		const closedTimestamp = daysAgoToHumanReadbleDate(this.daysSinceClose);
		const updatedTimestamp = daysAgoToHumanReadbleDate(this.daysSinceUpdate);
		const milestones = this.ignoredMilestones ? this.ignoredMilestones.split(',') : [];
		const milestonesQuery = milestones.map((milestone) => ` -milestone:"${milestone}"`).join('');
		const query =
			`repo:${this.github.repoOwner}/${this.github.repoName} closed:<${closedTimestamp} updated:<${updatedTimestamp} is:unlocked` +
			(this.label ? ` -label:${this.label}` : '') +
			(milestones.length > 0 ? milestonesQuery : '') +
			(this.typeIs ? ` is:${this.typeIs}` : '');

		for await (const page of this.github.query({ q: query, per_page: 50 })) {
			page.map(async (issue) => {
				const hydrated = await issue.getIssue();
				if (!hydrated) return;

				if (
					!hydrated.locked &&
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
					const skipDueToIgnoreLabel =
						this.ignoreLabelUntil &&
						this.labelUntil &&
						hydrated.labels.includes(this.ignoreLabelUntil) &&
						!hydrated.labels.includes(this.labelUntil);

					if (!skipDueToIgnoreLabel) {
						safeLog(`Locking issue ${hydrated.number}`);
						try {
							await issue.lockIssue();
						} catch (e) {
							safeLog(`Failed to lock issue ${hydrated.number}`);
							const err = e as Error;
							safeLog(err?.stack || err?.message || String(e));
						}
					} else {
						safeLog(`Not locking issue as it has ignoreLabelUntil but not labelUntil`);
					}
				} else {
					if (hydrated.locked) {
						safeLog(`Issue ${hydrated.number} is already locked. Ignoring`);
					} else {
						safeLog('Query returned an invalid issue:' + hydrated.number);
					}
				}
			});
		}
	}
}
