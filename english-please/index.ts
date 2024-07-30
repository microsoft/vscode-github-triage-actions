import { OctoKitIssue } from '../api/octokit';
import { Action } from '../common/Action';
import { getRequiredInput } from '../common/utils';
import { EnglishPleaseLabler, LanguageSpecificLabeler } from './EnglishPlease';

const nonEnglishLabel = getRequiredInput('nonEnglishLabel');
const needsMoreInfoLabel = getRequiredInput('needsMoreInfoLabel');
const translatorRequestedLabelPrefix = getRequiredInput('translatorRequestedLabelPrefix');
const translatorRequestedLabelColor = getRequiredInput('translatorRequestedLabelColor');
const cognitiveServicesAPIKey = getRequiredInput('cognitiveServicesAPIKey');

class EnglishPlease extends Action {
	id = 'EnglishPlease';

	async onOpened(issue: OctoKitIssue) {
		await new EnglishPleaseLabler(issue, nonEnglishLabel).run();
	}

	async doLanguageSpecific(issue: OctoKitIssue) {
		await new LanguageSpecificLabeler(
			issue,
			translatorRequestedLabelPrefix,
			translatorRequestedLabelColor,
			nonEnglishLabel,
			needsMoreInfoLabel,
			cognitiveServicesAPIKey,
		).run();
	}

	async onEdited(issue: OctoKitIssue) {
		await this.doLanguageSpecific(issue);
	}
	async onLabeled(issue: OctoKitIssue, label: string) {
		if (label == nonEnglishLabel) await this.doLanguageSpecific(issue);
	}
}

new EnglishPlease().run() // eslint-disable-line
