import * as core from '@actions/core'
import { context } from '@actions/github'
import { getRequiredInput, logErrorToIssue, logRateLimit, loadLatestRelease } from '../common/utils'
import { uploadBlobText, downloadBlobText } from '../classifier/blobStorage'
import { OctoKit } from '../api/octokit'

const token = getRequiredInput('token')
const storageKey = getRequiredInput('storageKey')

const update = async (quality: 'stable' | 'insider') => {
	let lastKnown: undefined | string = undefined
	try {
		lastKnown = await downloadBlobText('latest-' + quality, 'latest-releases', storageKey)
	} catch {
		// pass
	}

	const latest = (await loadLatestRelease(quality))?.version
	if (latest && latest !== lastKnown) {
		console.log('found a new release of', quality)
		await uploadBlobText('latest-' + quality, latest, 'latest-releases', storageKey)
		await new OctoKit(token, context.repo).dispatch('released-' + quality)
	}
}

const main = async () => {
	await update('insider')
	await update('stable')
}

main()
	.then(() => logRateLimit(token))
	.catch(async (error) => {
		core.setFailed(error.message)
		await logErrorToIssue(error, true, token)
	})
