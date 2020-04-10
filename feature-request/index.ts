/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as core from '@actions/core'
import { context } from '@actions/github'
import { OctoKit, OctoKitIssue } from '../api/octokit'
import { getRequiredInput, logErrorToIssue, logRateLimit } from '../utils/utils'
import {
	FeatureRequestConfig,
	FeatureRequestOnLabel,
	FeatureRequestQueryer,
	FeatureRequestOnMilestone,
} from './FeatureRequest'

const token = getRequiredInput('token')

const main = async () => {
	if (context.eventName === 'repository_dispatch' && context.payload.action !== 'trigger_feature_request') {
		return
	}

	const config: FeatureRequestConfig = {
		milestones: {
			candidateID: +getRequiredInput('candidateMilestoneID'),
			candidateName: getRequiredInput('candidateMilestoneName'),
			backlogID: +getRequiredInput('backlogMilestoneID'),
		},
		featureRequestLabel: getRequiredInput('featureRequestLabel'),
		upvotesRequired: +getRequiredInput('upvotesRequired'),
		numCommentsOverride: +getRequiredInput('numCommentsOverride'),
		comments: {
			init: getRequiredInput('initComment'),
			warn: getRequiredInput('warnComment'),
			accept: getRequiredInput('acceptComment'),
			reject: getRequiredInput('rejectComment'),
		},
		delays: {
			warn: +getRequiredInput('warnDays'),
			close: +getRequiredInput('closeDays'),
		},
	}

	if (context.eventName === 'schedule' || context.eventName === 'repository_dispatch') {
		console.log('query triggered')
		await new FeatureRequestQueryer(new OctoKit(token, context.repo), config).run()
	} else if (context.eventName === 'issues') {
		if (
			context.payload.action === 'labeled' &&
			context.payload.label.name === config.featureRequestLabel
		) {
			await new FeatureRequestOnLabel(
				new OctoKitIssue(token, context.repo, { number: context.issue.number }),
				+getRequiredInput('milestoneDelaySeconds'),
				config.milestones.candidateID,
				config.featureRequestLabel,
			).run()
		} else if (context.payload.action === 'milestoned') {
			await new FeatureRequestOnMilestone(
				new OctoKitIssue(token, context.repo, { number: context.issue.number }),
				config.comments.init,
				config.milestones.candidateID,
			).run()
		}
	}
}

main()
	.then(() => logRateLimit(token))
	.catch(async (error) => {
		core.setFailed(error.message)
		await logErrorToIssue(error, true, token)
	})
