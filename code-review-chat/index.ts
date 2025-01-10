/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PayloadRepository, WebhookPayload } from '@actions/github/lib/interfaces';
import { Octokit } from '@octokit/rest';
import { OctoKitIssue } from '../api/octokit';
import { VSCodeToolsAPIManager } from '../api/vscodeTools';
import { Action } from '../common/Action';
import { getInput, getRequiredInput, safeLog } from '../common/utils';
import {
	CodeReviewChat,
	CodeReviewChatDeleter,
	createPRObject,
	getTeamMemberReviews,
	meetsReviewThreshold,
} from './CodeReviewChat';

const slackToken = getRequiredInput('slack_token');
const elevatedUserToken = getInput('slack_user_token');
const channelId = getRequiredInput('notification_channel_id');

class CodeReviewChatAction extends Action {
	id = 'CodeReviewChat';

	private async closedOrDraftHandler(_issue: OctoKitIssue, payload: WebhookPayload) {
		if (!payload.pull_request || !payload.repository || !payload.pull_request.html_url) {
			throw Error('expected payload to contain pull request url');
		}
		await new CodeReviewChatDeleter(
			slackToken,
			elevatedUserToken,
			channelId,
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

		const auth = await this.getToken();
		const github = new Octokit({ auth });

		await new Promise((resolve) => setTimeout(resolve, 1 * 60 * 1000));

		await this.executeCodeReviewChat(github, issue, payload, false);
	}

	private async executeCodeReviewChat(
		github: Octokit,
		issue: OctoKitIssue,
		payload: WebhookPayload,
		external: boolean,
	) {
		if (!payload.pull_request || !payload.repository) {
			throw Error('expected payload to contain pull request and repository');
		}
		return new CodeReviewChat(
			github,
			new VSCodeToolsAPIManager(),
			issue,
			{
				slackToken,
				codereviewChannelId: channelId,
				payload: {
					owner: payload.repository.owner.login,
					repo: payload.repository.name,
					repo_url: payload.repository.html_url,
					repo_full_name: payload.repository.full_name ?? payload.repository.name,
					// https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads#pull_request
					pr: createPRObject(payload.pull_request),
				},
			},
			payload.pull_request.number,
			external,
		).run();
	}

	/**
	 * TODO @lramos15 Extend support possibly to the base action
	 */
	private async onSubmitReview(issue: OctoKitIssue, payload: WebhookPayload): Promise<void> {
		if (!payload.pull_request || !payload.repository) {
			throw Error('expected payload to contain pull request url');
		}

		if (payload.pull_request.state === 'closed') {
			// PR was merged and a review was submitted after merge. Skip posting message
			safeLog(`PR was already merged. Skipping posting message`);
			return;
		}

		const toolsAPI = new VSCodeToolsAPIManager();
		const teamMembers = new Set((await toolsAPI.getTeamMembers()).map((t) => t.id));
		const auth = await this.getToken();
		const github = new Octokit({ auth });
		const meetsThreshold = await meetsReviewThreshold(
			github,
			teamMembers,
			payload.pull_request.number,
			payload.repository.name,
			payload.repository.owner.login,
			issue,
		);
		// Only delete this message if the review threshold has been met
		if (meetsThreshold) {
			safeLog(`Review threshold met, deleting ${payload.pull_request.html_url}}`);
			await this.closedOrDraftHandler(issue, payload);
		}

		// TODO @lramos15, possibly move more of this into CodeReviewChat.ts to keep index smal

		// Check if the PR author is in the team
		const author = payload.pull_request.user.login;
		if (!teamMembers.has(author) && payload.pull_request.user?.type !== 'Bot') {
			safeLog('PR author is not in the team, checking if they need to be posted for another review');
			const teamMemberReviews = await getTeamMemberReviews(
				github,
				teamMembers,
				payload.pull_request.number,
				payload.repository.name,
				payload.repository.owner.login,
				issue,
				true /* isExternalPR */,
			);
			safeLog(`Found ${teamMemberReviews?.length ?? 0} reviews from team members`);
			// Get only the approving reviews from team members
			const approvingReviews = teamMemberReviews?.filter((review) => {
				safeLog(`Reviewer: ${review?.user?.login} - ${review.state}`);
				return review.state === 'APPROVED';
			});
			if (approvingReviews && approvingReviews.length === 1) {
				safeLog(`External PR with one review received, posting to receive a second`);
				await this.executeCodeReviewChat(github, issue, payload, true);
			}
		}
	}

	// Handles the event when a review is assigned to a pull request
	private async onAssignedReview(issue: OctoKitIssue, payload: WebhookPayload): Promise<void> {
		// Ensure the payload contains pull request and repository information
		if (!payload.pull_request || !payload.repository) {
			throw Error('expected payload to contain pull request url');
		}

		// Get the issue data
		const issueData = await issue.getIssue();
		if (!issueData) return;

		// If there are multiple assignees and the issue has the 'triage-needed' label
		if (issueData.assignees.length > 1 && issueData.labels.includes('triage-needed')) {
			// Get the username of the assigner of the first assignee
			const assigner = await issue.getAssigner(issueData.assignees[0]);

			// If the assigner is not the bot itself
			if (assigner !== getRequiredInput('botName')) {
				// Log the assigner and remove the 'triage-needed' label
				safeLog(`Assigner: ${assigner}`);
				await issue.removeLabel('triage-needed');
				return;
			}
		}
	}

	protected override async onTriggered() {
		// This function is only called during a manual workspace dispatch event
		// caused by a webhook, so we know to expect some inputs.
		const action = getRequiredInput('action');
		const pull_request = JSON.parse(getRequiredInput('pull_request'));
		const draft = pull_request.draft || false;
		if (draft) {
			safeLog('PR is draft, ignoring');
			return;
		}

		const repository: PayloadRepository = JSON.parse(getRequiredInput('repository'));
		const pr_number: number = parseInt(getRequiredInput('pr_number'));
		const auth = await this.getToken();
		const octokitIssue = new OctoKitIssue(
			auth,
			{ owner: repository.owner.login, repo: repository.name },
			{ number: pr_number },
		);

		const payload: WebhookPayload = { repository, pull_request };
		switch (action) {
			case 'opened':
			case 'ready_for_review':
				await this.onOpened(octokitIssue, payload);
				break;
			case 'submitted':
				await this.onSubmitReview(octokitIssue, payload);
				break;
			case 'closed':
				await this.onClosed(octokitIssue, payload);
				break;
			case 'converted_to_draft':
				await this.onConvertedToDraft(octokitIssue, payload);
				break;
			// These are part of the webhook chain, let's no-op but allow the CI to pass
			case 'dismissed':
			case 'synchronize':
			case 'reopened':
				break;
			case 'assigned':
				await this.onAssignedReview(octokitIssue, payload);
				break;
			default:
				throw Error(`Unknown action: ${action}`);
		}
		return;
	}
}

new CodeReviewChatAction().run() // eslint-disable-line
