/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OctoKit } from '../api/octokit';
import { downloadBlobText, uploadBlobText } from '../classifier/blobStorage';
import { Action } from '../common/Action';
import { loadLatestRelease, safeLog } from '../common/utils';

class LatestReleaseMonitor extends Action {
	id = 'LatestReleaseMonitor';

	private async update(quality: 'stable' | 'insider') {
		let lastKnown: undefined | string = undefined;
		try {
			lastKnown = await downloadBlobText('latest-' + quality, 'latest-releases');
		} catch {
			// pass
		}

		const latest = (await loadLatestRelease(quality))?.version;
		if (latest && latest !== lastKnown) {
			safeLog('found a new release of', quality);
			const owner = 'microsoft';
			const repo = 'vscode-engineering';
			const token = await this.getToken();
			await uploadBlobText('latest-' + quality, latest, 'latest-releases');
			await new OctoKit(token, { owner, repo }).dispatch('released-' + quality);
		}
	}

	async onTriggered() {
		await this.update('insider');
		await this.update('stable');
	}
}

new LatestReleaseMonitor().run() // eslint-disable-line
