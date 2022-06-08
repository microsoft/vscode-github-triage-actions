/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Octokit } from '@octokit/rest';
import { getRequiredInput, getInput } from '../common/utils';
import { CodeReviewChat, CodeReviewChatDeleter } from './CodeReviewChat';
import { Action } from '../common/Action';
import { OctoKitIssue } from '../api/octokit';

const slackToken = getRequiredInput('slack_token');
const elevatedUserToken = getInput('slack_user_token');
const auth = getRequiredInput('token');
const channel = getRequiredInput('notification_channel');

import { WebhookPayload } from '@actions/github/lib/interfaces';

class CodeReviewChatAction extends Action {
	id = 'CodeReviewChat';

	protected override async onClosed(_issue: OctoKitIssue, payload: WebhookPayload): Promise<void> {
		if (!payload.pull_request || !payload.repository || !payload.pull_request.html_url) {
			throw Error('expected payload to contain pull request url');
		}
		await new CodeReviewChatDeleter(
			slackToken,
			elevatedUserToken,
			channel,
			payload.pull_request.html_url,
		).run();
	}

	protected override async onOpened(issue: OctoKitIssue, payload: WebhookPayload): Promise<void> {
		if (!payload.pull_request || !payload.repository) {
			throw Error('expected payload to contain pull request and repository');
		}

		const github = new Octokit({ auth });

		await new Promise((resolve) => setTimeout(resolve, 1 * 60 * 1000));

		await new CodeReviewChat(github, issue, {
			slackToken,
			codereviewChannel: channel,
			payload: {
				owner: payload.repository.owner.login,
				repo: payload.repository.name,
				// https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads#pull_request
				pr: {
					number: payload.pull_request.number,
					body: payload.pull_request.body || '',
					additions: payload.pull_request.additions,
					deletions: payload.pull_request.deletions,
					changed_files: payload.pull_request.changed_files,
					url: payload.pull_request.html_url || '',
					owner: payload.pull_request.user.login,
					draft: payload.pull_request.draft || false,
					title: payload.pull_request.title,
				},
			},
		}).run();
	}
}

new CodeReviewChatAction().run() // eslint-disable-line
