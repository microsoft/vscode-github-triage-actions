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
	constructor(
		slackToken: string,
		notificationChannel: string,
		private prUrl: string,
		private botName: string,
	) {
		super(slackToken, notificationChannel);
	}

	async run() {
		const { client, channel } = await this.getChat();
		const response = await client.conversations.history({
			channel,
		});
		if (!response.ok || !response.messages) {
			throw Error('Error getting channel history');
		}
		const messages: { ts: string; text?: string }[] = response.messages as any;
		const message = messages?.filter((message) => message.text?.includes(this.prUrl))[0];
		if (!message) {
			safeLog('no message found, exiting');
		}
		try {
			await client.chat.delete({
				channel,
				ts: message.ts,
			});
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

				const hasExisting = existingReviews?.data?.length || existingRequests?.data?.users?.length;
				if (hasExisting) {
					safeLog('had existing review requests, exiting');
					return;
				}

				const changedFilesMessage =
					`${this.pr.changed_files} file` + (this.pr.changed_files > 1 ? 's' : '');
				const diffMessage = `+${this.pr.additions.toLocaleString()} -${this.pr.deletions.toLocaleString()}, ${changedFilesMessage}`;
				const message = `${this.pr.owner}: \`${diffMessage}\` <${this.pr.url}|${this.pr.title}>`;
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
		groups = (await web.conversations.list({
			types: 'public_channel,private_channel',
			cursor: groups?.response_metadata?.next_cursor,
			limit: 100,
		})) as unknown as ConversationsList;
		channels.push(...groups.channels);
	} while (groups.response_metadata?.next_cursor);
	return channels.filter((c) => c.is_member);
}
