/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GitHub } from '../api/api'
import { daysAgoToHumanReadbleDate } from '../common/utils'

export class Locker {
	constructor(
		private github: GitHub,
		private daysSinceClose: number,
		private daysSinceUpdate: number,
		private label?: string,
	) {}

	async run() {
		const closedTimestamp = daysAgoToHumanReadbleDate(this.daysSinceClose)
		const updatedTimestamp = daysAgoToHumanReadbleDate(this.daysSinceUpdate)

		const query =
			`closed:<${closedTimestamp} updated:<${updatedTimestamp} is:unlocked` +
			(this.label ? ` -label:${this.label}` : '')

		for await (const page of this.github.query({ q: query })) {
			await Promise.all(
				page.map(async (issue) => {
					const hydrated = await issue.getIssue()

					if (
						!hydrated.locked &&
						hydrated.open === false &&
						(!this.label || !hydrated.labels.includes(this.label))
						// TODO: Verify closed and updated timestamps
					) {
						console.log(`Locking issue ${hydrated.number}`)
						await issue.lockIssue()
					} else {
						if (hydrated.locked) {
							console.log(`Issue ${hydrated.number} is already locked. Ignoring`)
						} else {
							console.log(
								'Query returned an invalid issue:' +
									JSON.stringify({ ...hydrated, body: 'stripped' }),
							)
						}
					}
				}),
			)
		}
	}
}
