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

export class BuildChat {
	private pr: PR;
	constructor(private octokit: Octokit, private issue: GitHubIssue, private options: Options) {
		this.pr = options.payload.pr;
	}

	private async postMessage(message: string) {
		const web = new WebClient(this.options.slackToken);
		const memberships = await listAllMemberships(web);

		const codereviewChannel =
			this.options.codereviewChannel &&
			memberships.find((m) => m.name === this.options.codereviewChannel);

		if (!codereviewChannel) {
			throw Error(`Slack channel not found: ${this.options.codereviewChannel}`);
		}

		await web.chat.postMessage({
			text: message,
			link_names: true,
			channel: codereviewChannel.id,
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
		if (!data.assignee) {
			await this.issue.addAssignee(author.name);
		}
		const currentMilestone = await this.issue.getCurrentRepoMilestone();
		if (!data.milestone && currentMilestone) {
			await this.issue.setMilestone(currentMilestone);
		}

		const existing = await this.octokit.pulls.listReviewRequests({
			owner: this.options.payload.owner,
			repo: this.options.payload.repo,
			pull_number: this.options.payload.pr.number,
		});
		const hasRequests = existing?.data?.users?.length;
		if (hasRequests) {
			safeLog('had existing review requests, exiting');
			return;
		}
		const changedFilesMessage = `${this.pr.changed_files} file` + (this.pr.changed_files > 1 ? 's' : '');
		const message = `${this.pr.owner}: \`+${this.pr.additions.toLocaleString()} -${this.pr.deletions.toLocaleString()}, ${changedFilesMessage}\` [${this.pr.title}](${this.pr.url})`;
		safeLog(message);
		await this.postMessage(message);
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
