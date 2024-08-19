/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OctoKit, OctoKitIssue } from '../api/octokit';
import { Action } from '../common/Action';
import { getInput, getRequiredInput } from '../common/utils';
import {
	FeatureRequestConfig,
	FeatureRequestOnLabel,
	FeatureRequestOnMilestone,
	FeatureRequestQueryer,
} from './FeatureRequest';

const config: FeatureRequestConfig = {
	milestones: {
		candidateID: +getRequiredInput('candidateMilestoneID'),
		candidateName: getRequiredInput('candidateMilestoneName'),
		backlogID: +getRequiredInput('backlogMilestoneID'),
	},
	featureRequestLabel: getRequiredInput('featureRequestLabel'),
	upvotesRequired: +getRequiredInput('upvotesRequired'),
	numCommentsOverride: +getRequiredInput('numCommentsOverride'),
	labelsToExclude: ((getInput('labelsToExclude') as string) || '').split(',').filter((l) => !!l),
	comments: {
		init: getRequiredInput('initComment'),
		warn: getRequiredInput('warnComment'),
		accept: getRequiredInput('acceptComment'),
		reject: getRequiredInput('rejectComment'),
		rejectLabel: getInput('rejectLabel'),
	},
	delays: {
		warn: +getRequiredInput('warnDays'),
		close: +getRequiredInput('closeDays'),
	},
};

class FeatureRequest extends Action {
	id = 'FeatureRequest';

	async onLabeled(github: OctoKitIssue, label: string) {
		if (label === config.featureRequestLabel) {
			await new FeatureRequestOnLabel(
				github,
				+getRequiredInput('milestoneDelaySeconds'),
				config.milestones.candidateID,
				config.featureRequestLabel,
			).run();
		}
	}

	async onMilestoned(github: OctoKitIssue) {
		await new FeatureRequestOnMilestone(
			github,
			config.comments.init!,
			config.milestones.candidateID,
		).run();
	}

	async onTriggered(_github: OctoKit) {
		const auth = await this.getToken();
		const repo = getRequiredInput('repo');
		const owner = getRequiredInput('owner');
		const github = new OctoKit(auth, { owner, repo });
		await new FeatureRequestQueryer(github, config).run();
	}
}

new FeatureRequest().run() // eslint-disable-line
