/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Octokit } from '@octokit/rest';
import { getRequiredInput, getInput, safeLog } from '../common/utils';
import { CodeReviewChat, CodeReviewChatDeleter } from './CodeReviewChat';
import { Action } from '../common/Action';
import { OctoKitIssue } from '../api/octokit';
import { PayloadRepository, WebhookPayload } from '@actions/github/lib/interfaces';

const slackToken = getRequiredInput('slack_token');
const elevatedUserToken = getInput('slack_user_token');
const auth = getRequiredInput('token');
const channel = getRequiredInput('notification_channel');

class CodeReviewChatAction extends Action {
	id = 'CodeReviewChat';

	private async closedOrDraftHandler(_issue: OctoKitIssue, payload: WebhookPayload) {
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

	protected override async onClosed(_issue: OctoKitIssue, payload: WebhookPayload): Promise<void> {
		await this.closedOrDraftHandler(_issue, payload);
	}

	protected override async onConvertedToDraft(
		_issue: OctoKitIssue,
		payload: WebhookPayload,
	): Promise<void> {
		await this.closedOrDraftHandler(_issue, payload);
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
				repo_url: payload.repository.html_url,
				repo_full_name: payload.repository.full_name ?? payload.repository.name,
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
					baseBranchName: payload.pull_request.base.ref ?? '',
					headBranchName: payload.pull_request.head.ref ?? '',
					title: payload.pull_request.title,
				},
			},
		}).run();
	}

	protected override async onTriggered() {
		// This function is only called during a manual workspace dispatch event
		// caused by a webhook, so we know to expect some inputs.
		const action = getRequiredInput('action');
		const pull_request = JSON.parse(getRequiredInput('pull_request'));
		const repository: PayloadRepository = JSON.parse(getRequiredInput('repository'));
		const pr_number: number = parseInt(getRequiredInput('pr_number'));

		const octokitIssue = new OctoKitIssue(
			auth,
			{ owner: repository.owner.login, repo: repository.name },
			{ number: pr_number },
		);

		// Query repo to see if it has a .github/workflows/pr-chat.yml file
		const ghAPI = new Octokit({ auth });
		try {
			const fileContent = await ghAPI.repos.getContent({
				owner: repository.owner.login,
				repo: repository.name,
				path: '.github/workflows/pr-chat.yml',
			});
			// 200 Response means it exists, so we exit as webhook implementation is only if pr-chat.yml isn't present
			if (fileContent.status === 200) {
				safeLog('Skipping webhook implementation since pr-chat.yml is present');
				return;
			}
		} catch {
			// No-op, file doesn't exist
		}

		const payload: WebhookPayload = { repository, pull_request };
		switch (action) {
			case 'opened':
			case 'ready_for_review':
				await this.onOpened(octokitIssue, payload);
				break;
			case 'closed':
			case 'submitted':
				await this.onClosed(octokitIssue, payload);
				break;
			case 'converted_to_draft':
				await this.onConvertedToDraft(octokitIssue, payload);
				break;
			default:
				throw Error(`Unknown action: ${action}`);
		}
		return;
	}
}

new CodeReviewChatAction().run() // eslint-disable-line
