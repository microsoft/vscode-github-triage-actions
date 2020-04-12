import axios from 'axios'
import { GitHubIssue } from '../api/api'
import { normalizeIssue } from '../utils/utils'
import { commonNames as _commonNames, knownTranslations as _knownTranslations } from './translation-data.json'

const commonNames: { [langCode: string]: string | undefined } = _commonNames
const knownTranslations: { [langCode: string]: string | undefined } & { en: string } = _knownTranslations

const usKeyboardChars = /\w|\s|\d|[[\]{}`~!@#$%^&*()_+=<>,.?/\\:;'"|-]/gu
const emojiChars = /[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/gu

export class EnglishPleaseLabler {
	constructor(private issue: GitHubIssue, private englishPleaseLabel: string) {}

	async run() {
		const issue = await this.issue.getIssue()
		const { body, title } = normalizeIssue(issue)
		const translationChunk = `${title} ${body}`

		const nonenglishChunk = translationChunk.replace(usKeyboardChars, '').replace(emojiChars, '')

		if (nonenglishChunk.length / translationChunk.length < 0.05) {
			await this.issue.addLabel(this.englishPleaseLabel)
		}
	}
}

export class LanguageSpecificLabeler {
	constructor(
		private issue: GitHubIssue,
		private translatorRequestedLabelPrefix: string,
		private translatorRequestedLabelColor: string,
		private englishPleaseLabel: string,
		private needsMoreInfoLabel: string,
		private cognitiveServicesAPIKey: string,
	) {}

	private async detectLanguage(chunk: string): Promise<string | undefined> {
		const result = await axios.post(
			'https://api.cognitive.microsofttranslator.com/detect?api-version=3.0',
			JSON.stringify([{ text: chunk.slice(0, 200) }]),
			{
				headers: {
					'Ocp-Apim-Subscription-Key': this.cognitiveServicesAPIKey,
					'Content-type': 'application/json',
				},
			},
		)
		return result?.data?.[0].language ?? undefined
	}

	private async translate(text: string, to: string): Promise<string | undefined> {
		const result = await axios.post(
			'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=' + to,
			JSON.stringify([{ text }]),
			{
				headers: {
					'Ocp-Apim-Subscription-Key': this.cognitiveServicesAPIKey,
					'Content-type': 'application/json',
				},
			},
		)
		return result?.data?.[0].translations?.[0].text ?? undefined
	}

	async run() {
		const issue = await this.issue.getIssue()
		const { body, title } = normalizeIssue(issue)
		const translationChunk = `${title} ${body}`

		const language = await this.detectLanguage(translationChunk)
		if (!language || language === 'en') {
			const languagelabel = issue.labels.find((label) =>
				label.startsWith(this.translatorRequestedLabelPrefix),
			)
			if (languagelabel) await this.issue.removeLabel(languagelabel)
			await this.issue.removeLabel(this.englishPleaseLabel)
			await this.issue.removeLabel(this.needsMoreInfoLabel)
		} else if (language) {
			const label = this.translatorRequestedLabelPrefix + commonNames[language]
			if (!(await this.issue.repoHasLabel(label))) {
				console.log('Globally creating label ' + label)
				await this.issue.createLabel(label, this.translatorRequestedLabelColor, '')
			}
			await this.issue.addLabel(label)
			if (this.needsMoreInfoLabel) await this.issue.addLabel(this.needsMoreInfoLabel)

			const targetLanguageComment =
				knownTranslations[language] ??
				(await this.translate(knownTranslations['en'], language)) ??
				'ERR_TRANSLATION_FAILED'

			const englishComment = knownTranslations['en']

			await this.issue.postComment(
				`${targetLanguageComment}\n---\n${englishComment}\n<!-- translation_requested_comment -->`,
			)
		}
	}
}
