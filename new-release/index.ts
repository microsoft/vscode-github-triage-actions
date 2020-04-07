import * as core from '@actions/core'
import { context } from '@actions/github'
import { OctoKitIssue } from '../api/octokit'
import { getRequiredInput, logErrorToIssue, logRateLimit } from '../utils/utils'
import { NewRelease } from './NewRelease'

const main = async () => {
	await new NewRelease(
		new OctoKitIssue(getRequiredInput('token'), context.repo, { number: context.issue.number }),
		getRequiredInput('label'),
		getRequiredInput('labelColor'),
		getRequiredInput('labelDescription'),
		+getRequiredInput('days'),
	).run()
}

main()
	.then(logRateLimit)
	.catch(async (error) => {
		core.setFailed(error.message)
		await logErrorToIssue(error.message, true)
	})
