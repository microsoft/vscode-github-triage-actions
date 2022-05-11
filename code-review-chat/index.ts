/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Octokit } from '@octokit/rest';
import { getInput, getRequiredInput } from '../common/utils';
import { BuildChat } from './CodeReviewChat';
import { Action } from '../common/Action';
import { OctoKitIssue } from '../api/octokit';
import { WebhookPayload } from '@actions/github/lib/interfaces';

class CodeReviewChatAction extends Action {
	id = 'CodeReviewChat';

	protected override async onOpened(issue: OctoKitIssue, payload: WebhookPayload): Promise<void> {
		if (!payload.pull_request || !payload.repository) {
			throw Error('expected payload to contain pull request and repository');
		}

		const slackToken = getInput('slack_token');
		if (!slackToken) {
			return;
		}
		const auth = getRequiredInput('token');
		const github = new Octokit({ auth });

		await new Promise((resolve) => setTimeout(resolve, 1 * 60 * 1000));

		await new BuildChat(github, issue, {
			slackToken,
			storageConnectionString: getRequiredInput('storage_connection_string'),
			codereviewChannel: getRequiredInput('notification_channel'),
			payload: {
				owner: payload.repository.owner.login,
				repo: payload.repository.name,
				pr: {
					number: payload.pull_request.number,
					body: payload.pull_request.body || '',
					additions: payload.pull_request.additions,
					deletions: payload.pull_request.deletions,
					changed_files: payload.pull_request.changed_files,
					url: payload.pull_request.html_url || '',
					owner: payload.pull_request.user.login,
					draft: payload.pull_request.draft || false,
				},
			},
		}).run();
	}
}

new CodeReviewChatAction().run() // eslint-disable-line
