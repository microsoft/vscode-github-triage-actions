import * as core from '@actions/core'
import { readFileSync } from 'fs'
import { context } from '@actions/github'
import { OctoKit } from '../../api/octokit'
import { getRequiredInput, logErrorToIssue, logRateLimit } from '../../utils/utils'

const token = getRequiredInput('token')

const main = async () => {
	const _github = new OctoKit(token, context.repo)
	const file = JSON.parse(readFileSync(__dirname + '../issue_labels.json', { encoding: 'utf8' }))
	console.log('Got labelings', JSON.stringify(file, null, 2))
}

main()
	.then(() => logRateLimit(token))
	.catch(async (error) => {
		core.setFailed(error.message)
		await logErrorToIssue(error.message, true, token)
	})
