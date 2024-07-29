import { OctoKit, OctoKitIssue } from '../api/octokit';
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

	async onTriggered(_octokit: OctoKit): Promise<void> {
		// This function is only called during a manual workspace dispatch event
		// caused by a webhook, so we know to expect some inputs.
		const auth = await this.getToken();
		const repo = getRequiredInput('repo');
		const owner = getRequiredInput('owner');
		const issueNumber = +getRequiredInput('issue_number');
		const octokitIssue = new OctoKitIssue(auth, { owner, repo }, { number: issueNumber });
		await this.doLanguageSpecific(octokitIssue);
	}
}

new EnglishPlease().run() // eslint-disable-line
