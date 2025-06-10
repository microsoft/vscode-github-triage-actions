/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

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
	PR,
} from './CodeReviewChat';

const slackToken = getRequiredInput('slack_token');
const elevatedUserToken = getInput('slack_user_token');
const channelId = getRequiredInput('notification_channel_id');

class CodeReviewChatAction extends Action {
	id = 'CodeReviewChat';

	private async closedOrDraftHandler(_issue: OctoKitIssue, pr: PR) {
		await new CodeReviewChatDeleter(slackToken, elevatedUserToken, channelId, pr.url).run();
	}

	protected override async onClosed(_issue: OctoKitIssue, pr: PR): Promise<void> {
		await this.closedOrDraftHandler(_issue, pr);
	}

	protected override async onConvertedToDraft(_issue: OctoKitIssue, pr: PR): Promise<void> {
		await this.closedOrDraftHandler(_issue, pr);
	}

	protected override async onOpened(issue: OctoKitIssue, pr: PR): Promise<void> {
		const auth = await this.getToken();
		const github = new Octokit({ auth });

		await new Promise((resolve) => setTimeout(resolve, 1 * 60 * 1000));

		await this.executeCodeReviewChat(github, issue, pr, false);
	}

	private async executeCodeReviewChat(github: Octokit, issue: OctoKitIssue, pr: PR, external: boolean) {
		return new CodeReviewChat(
			github,
			new VSCodeToolsAPIManager(),
			issue,
			{
				slackToken,
				codereviewChannelId: channelId,
				payload: {
					owner: issue.repoOwner,
					repo: issue.repoName,
					repo_url: pr.url,
					repo_full_name: `${issue.repoOwner}/${issue.repoName}`,
					// https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads#pull_request
					pr: pr,
				},
			},
			pr.number,
			external,
		).run();
	}

	/**
	 * TODO @lramos15 Extend support possibly to the base action
	 */
	private async onSubmitReview(issue: OctoKitIssue, pr: PR): Promise<void> {
		if (pr.state === 'closed') {
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
			pr.number,
			issue.repoName,
			issue.repoOwner,
			issue,
		);
		// Only delete this message if the review threshold has been met
		if (meetsThreshold) {
			safeLog(`Review threshold met, deleting ${pr.url}}`);
			await this.closedOrDraftHandler(issue, pr);
		}

		// TODO @lramos15, possibly move more of this into CodeReviewChat.ts to keep index smal

		// Check if the PR author is in the team
		const author = pr.user.login;
		if (!teamMembers.has(author) && pr.user.type !== 'Bot') {
			safeLog('PR author is not in the team, checking if they need to be posted for another review');
			const teamMemberReviews = await getTeamMemberReviews(
				github,
				teamMembers,
				pr.number,
				issue.repoName,
				issue.repoOwner,
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
				await this.executeCodeReviewChat(github, issue, pr, true);
			}
		}
	}

	// Handles the event when a review is assigned to a pull request
	private async onAssignedReview(issue: OctoKitIssue): Promise<void> {
		// Get the issue data
		const issueData = await issue.getIssue();
		if (!issueData) return;

		// If there are multiple assignees and the issue has the 'triage-needed' label
		if (issueData.assignees.length > 1 && issueData.labels.includes('triage-needed')) {
			// Get the username of the assigner of the first assignee
			const assigner = await issue.getAssigner(issueData.assignees[0]);
			const toolsAPI = new VSCodeToolsAPIManager();

			const teamMember = await toolsAPI.getTeamMemberFromGitHubId(assigner);
			// If the assigner is a team member, remove the 'triage-needed' label
			if (teamMember) {
				// Log the assigner and remove the 'triage-needed' label
				safeLog(`Assigner: ${assigner}`);
				await issue.removeLabel('triage-needed');
				return;
			}
		}
	}

	private async onDismissedReview(issue: OctoKitIssue, pr: PR): Promise<void> {
		if (pr.state === 'closed') {
			// PR was merged and a review was submitted after merge. Skip posting message
			safeLog(`PR was already merged. Skipping posting message`);
			return;
		}

		await this.executeCodeReviewChat(
			new Octokit({ auth: await this.getToken() }),
			issue,
			pr,
			false /* external */,
		);

		safeLog('Review dismissed, no action taken');
	}

	protected override async onTriggered() {
		const auth = await this.getToken();
		const github = new Octokit({ auth });

		const owner = getRequiredInput('owner');
		const repo = getRequiredInput('repo');
		const action = getRequiredInput('action');

		const pr_number: number = parseInt(getRequiredInput('pr_number'));
		const prFromApi = (
			await github.pulls.get({
				pull_number: pr_number,
				owner,
				repo,
			})
		).data;

		const pr = createPRObject(prFromApi);
		const octokitIssue = new OctoKitIssue(auth, { owner, repo }, { number: pr_number });
		switch (action) {
			case 'opened':
			case 'ready_for_review':
				await this.onOpened(octokitIssue, pr);
				break;
			case 'submitted':
				await this.onSubmitReview(octokitIssue, pr);
				break;
			case 'closed':
				await this.onClosed(octokitIssue, pr);
				break;
			case 'converted_to_draft':
				await this.onConvertedToDraft(octokitIssue, pr);
				break;
			// These are part of the webhook chain, let's no-op but allow the CI to pass
			case 'dismissed':
				await this.onDismissedReview(octokitIssue, pr);
				break;
			case 'synchronize':
			case 'reopened':
				break;
			case 'assigned':
				await this.onAssignedReview(octokitIssue);
				break;
			default:
				throw Error(`Unknown action: ${action}`);
		}
		return;
	}
}

new CodeReviewChatAction().run() // eslint-disable-line
