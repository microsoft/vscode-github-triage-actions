import { getRequiredInput, logRateLimit, logErrorToIssue } from '../utils/utils'
import { LanguageSpecificLabeler, EnglishPleaseLabler } from './EnglishPlease'
import { OctoKitIssue } from '../api/octokit'
import * as core from '@actions/core'
import { context } from '@actions/github'

const token = getRequiredInput('token')
const nonEnglishLabel = getRequiredInput('nonEnglishLabel')
const needsMoreInfoLabel = getRequiredInput('needsMoreInfoLabel')
const translatorRequestedLabelPrefix = getRequiredInput('translatorRequestedLabelPrefix')
const translatorRequestedLabelColor = getRequiredInput('translatorRequestedLabelColor')
const cognitiveServicesAPIKey = getRequiredInput('cognitiveServicesAPIKey')

const main = async () => {
	const issue = new OctoKitIssue(token, context.repo, { number: context.issue.number })

	// uses rough heuristics to check if issue is in foreign language
	const englishPleaseLabler = new EnglishPleaseLabler(issue, nonEnglishLabel)

	// uses azure cognitive services text translator api to detect specific language and post comment in that language
	const languageSpecificLabeler = new LanguageSpecificLabeler(
		issue,
		translatorRequestedLabelPrefix,
		translatorRequestedLabelColor,
		nonEnglishLabel,
		needsMoreInfoLabel,
		cognitiveServicesAPIKey,
	)

	if (context.payload.action === 'opened') {
		const isNonEnglish = await englishPleaseLabler.run()
		if (isNonEnglish) {
			await languageSpecificLabeler.run()
		}
	} else if (context.payload.action === 'edited' || context.payload.label?.name === nonEnglishLabel) {
		await languageSpecificLabeler.run()
	}
}

main()
	.then(() => logRateLimit(token))
	.catch(async (error) => {
		core.setFailed(error.message)
		await logErrorToIssue(error.message, true, token)
	})
