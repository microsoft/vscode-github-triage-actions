/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Octokit } from '@octokit/rest';
import { WebClient } from '@slack/web-api';
import { GitHubIssue } from '../api/api';
import { safeLog } from '../common/utils';

interface PR {
	number: number;
	body: string;
	additions: number;
	deletions: number;
	changed_files: number;
	url: string;
	owner: string;
	draft: boolean;
	title: string;
}

// Some slack typings since the API isn't the best in terms of typings
interface SlackReaction {
	name: string;
	count: number;
	users: string[];
}

interface SlackMessage {
	type: 'message';
	text: string;
	channel: string;
	ts: string;
	reactions: SlackReaction[];
}

export interface Options {
	slackToken: string;
	codereviewChannel: string;
	payload: {
		owner: string;
		repo: string;
		pr: PR;
	};
}

class Chatter {
	constructor(protected slackToken: string, protected notificationChannel: string) {}

	async getChat(): Promise<{ client: WebClient; channel: string }> {
		const web = new WebClient(this.slackToken);
		const memberships = await listAllMemberships(web);

		const codereviewChannel =
			this.notificationChannel && memberships.find((m) => m.name === this.notificationChannel);

		if (!codereviewChannel) {
			throw Error(`Slack channel not found: ${this.notificationChannel}`);
		}
		return { client: web, channel: codereviewChannel.id };
	}
}

export class CodeReviewChatDeleter extends Chatter {
	private elevatedClient: WebClient | undefined;
	constructor(
		slackToken: string,
		slackElevatedUserToken: string | undefined,
		notificationChannel: string,
		private prUrl: string,
	) {
		super(slackToken, notificationChannel);
		this.elevatedClient = slackElevatedUserToken ? new WebClient(slackElevatedUserToken) : undefined;
	}

	async run() {
		const { client, channel } = await this.getChat();
		// Get the last 200 messages (don't bother looking further than that)
		const response = await client.conversations.history({
			channel,
			limit: 200,
		});
		if (!response.ok || !response.messages) {
			throw Error('Error getting channel history');
		}
		const messages = response.messages as SlackMessage[];
		const messagesToDelete = messages.filter((message) => {
			const isCodeReviewMessage = message.text.includes(this.prUrl);
			if (this.elevatedClient) {
				// If we have an elevated client we can delete the message as long it has a "white_check_mark" reaction
				return (
					isCodeReviewMessage ||
					message.reactions.some((reaction) => reaction.name === 'white_check_mark')
				);
			}
			return isCodeReviewMessage;
		});
		if (messagesToDelete.length === 0) {
			safeLog('no message found, exiting');
		}
		try {
			// Attempt to use the correct client to delete the messages
			for (const message of messagesToDelete) {
				if (this.elevatedClient) {
					await this.elevatedClient.chat.delete({
						channel,
						ts: message.ts,
						as_user: true,
					});
				} else {
					await client.chat.delete({
						channel,
						ts: message.ts,
						as_user: false,
					});
				}
			}
		} catch (e) {
			safeLog('error deleting message, probably posted by some human');
		}
	}
}

export class CodeReviewChat extends Chatter {
	private pr: PR;
	constructor(private octokit: Octokit, private issue: GitHubIssue, private options: Options) {
		super(options.slackToken, options.codereviewChannel);
		this.pr = options.payload.pr;
	}

	private async postMessage(message: string) {
		const { client, channel } = await this.getChat();

		await client.chat.postMessage({
			text: message,
			channel,
			link_names: true,
			as_user: true,
		});
	}

	async run() {
		if (this.pr.draft) {
			safeLog('PR is draft, ignoring');
			return;
		}

		const data = await this.issue.getIssue();
		const author = data.author;
		if (!(await this.issue.hasWriteAccess(author))) {
			safeLog('Issue author not team member, ignoring');
			return;
		}
		const tasks = [];

		if (!data.assignee) {
			tasks.push(this.issue.addAssignee(author.name));
		}

		tasks.push(
			(async () => {
				const currentMilestone = await this.issue.getCurrentRepoMilestone();
				if (!data.milestone && currentMilestone) {
					await this.issue.setMilestone(currentMilestone);
				}
			})(),
		);

		tasks.push(
			(async () => {
				const [existingReviews, existingRequests] = await Promise.all([
					this.octokit.pulls.listReviews({
						owner: this.options.payload.owner,
						repo: this.options.payload.repo,
						pull_number: this.options.payload.pr.number,
					}),
					this.octokit.pulls.listReviewRequests({
						owner: this.options.payload.owner,
						repo: this.options.payload.repo,
						pull_number: this.options.payload.pr.number,
					}),
				]);

				// Check if there is any exisitng review. This excludes the author themselves as they don't count
				const hasExistingReview = existingReviews?.data?.some((review) => {
					return review.user.login !== author.name;
				});

				// Check to see if there is an existing review or review request. We don't check if the author is part of the review request as that isn't possible
				const hasExisting = hasExistingReview || existingRequests?.data?.users?.length;
				if (hasExisting) {
					safeLog('had existing review requests, exiting');
					return;
				}

				const cleanTitle = this.pr.title.replace(/`/g, '');
				const changedFilesMessage =
					`${this.pr.changed_files} file` + (this.pr.changed_files > 1 ? 's' : '');
				const diffMessage = `+${this.pr.additions.toLocaleString()} -${this.pr.deletions.toLocaleString()}, ${changedFilesMessage}`;
				const message = `${this.pr.owner}: \`${diffMessage}\` <${this.pr.url}|${cleanTitle}>`;
				safeLog(message);
				await this.postMessage(message);
			})(),
		);

		await Promise.all(tasks);
	}
}

interface Channel {
	id: string;
	name: string;
	is_member: boolean;
}

interface ConversationsList {
	channels: Channel[];
	response_metadata?: {
		next_cursor?: string;
	};
}

async function listAllMemberships(web: WebClient) {
	let groups: ConversationsList | undefined;
	const channels: Channel[] = [];
	do {
		try {
			groups = (await web.conversations.list({
				types: 'public_channel,private_channel',
				cursor: groups?.response_metadata?.next_cursor,
				limit: 100,
			})) as unknown as ConversationsList;
			channels.push(...groups.channels);
		} catch (err) {
			safeLog(`Error listing channels: ${err}`);
			groups = undefined;
		}
	} while (groups?.response_metadata?.next_cursor);
	return channels.filter((c) => c.is_member);
}
