/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GitHubIssue } from '../api/api';
import { loadLatestRelease, safeLog } from '../common/utils';

export class NewRelease {
	constructor(
		private github: GitHubIssue,
		private label: string,
		private labelColor: string,
		private labelDescription: string,
		private days: number,
		private oldVersionMessage?: string,
	) {}

	async run() {
		const release = await loadLatestRelease('stable');
		if (!(release && release.timestamp)) throw Error('Could not load latest release');
		const daysSinceRelease = (Date.now() - release.timestamp) / (24 * 60 * 60 * 1000);

		const issue = await this.github.getIssue();
		if (!issue) return;

		const cleansed = issue.body.replace(/<!-- .* -->/g, '');
		const productVersion = release.productVersion.endsWith('.0')
			? release.productVersion.replace(/\.0$/, '')
			: release.productVersion;
		if (
			this.oldVersionMessage &&
			!/insider/i.test(cleansed) &&
			!/\.dev/i.test(cleansed) &&
			/VS ?Code Version:.*\d/i.test(cleansed) &&
			!cleansed.includes(productVersion)
		) {
			await this.github.postComment(
				this.oldVersionMessage.replace('{currentVersion}', release.productVersion),
			);
			return;
		}

		if (daysSinceRelease > this.days) {
			// delete the label from the repo as a whole to remove it from all issues
			safeLog('New release window passed. Globally deleting label ' + this.label);
			return this.github.deleteLabel(this.label);
		}

		if (
			!/VS ?Code Version:.*Insider/i.test(cleansed) &&
			new RegExp(
				`VS ?Code Version:(.*[^\\d])?${productVersion.replace('.', '\\.')}([^\\d]|$)`,
				'i',
			).test(cleansed)
		) {
			if (!(await this.github.repoHasLabel(this.label))) {
				safeLog('First release issue found. Globally creating label ' + this.label);
				await this.github.createLabel(this.label, this.labelColor, this.labelDescription);
			}

			safeLog('New release issue found. Adding label ' + this.label);
			await this.github.addLabel(this.label);
		}
	}
}
