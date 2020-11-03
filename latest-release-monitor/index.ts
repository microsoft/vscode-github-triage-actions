/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { context } from '@actions/github'
import { getRequiredInput, loadLatestRelease, safeLog } from '../common/utils'
import { uploadBlobText, downloadBlobText } from '../classifier/blobStorage'
import { OctoKit } from '../api/octokit'
import { Action } from '../common/Action'

const token = getRequiredInput('token')
const storageKey = getRequiredInput('storageKey')

class LatestReleaseMonitor extends Action {
	id = 'LatestReleaseMonitor'

	private async update(quality: 'stable' | 'insider') {
		let lastKnown: undefined | string = undefined
		try {
			lastKnown = await downloadBlobText('latest-' + quality, 'latest-releases', storageKey)
		} catch {
			// pass
		}

		const latest = (await loadLatestRelease(quality))?.version
		if (latest && latest !== lastKnown) {
			safeLog('found a new release of', quality)
			await uploadBlobText('latest-' + quality, latest, 'latest-releases', storageKey)
			await new OctoKit(token, context.repo).dispatch('released-' + quality)
		}
	}

	async onTriggered() {
		await this.update('insider')
		await this.update('stable')
	}
}

new LatestReleaseMonitor().run() // eslint-disable-line
