/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { setFailed } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { WebhookPayload } from '@actions/github/lib/interfaces';
import { createAppAuth } from '@octokit/auth-app';
import { v4 as uuid } from 'uuid';
import { OctoKit, OctoKitIssue } from '../api/octokit';
import { getInput } from '../common/utils';
import { errorLoggingIssue, logErrorToIssue, safeLog } from './utils';

export abstract class Action {
	abstract id: string;
	repoName: string;
	repoOwner: string;
	issue: number | undefined;

	constructor() {
		console.log('::stop-commands::' + uuid());
		this.repoName = this.getRepoName();
		this.repoOwner = this.getRepoOwner();
		this.issue = this.getIssueNumber();
	}

	async getToken(): Promise<string> {
		// Temporary workaround until all workflows have been updated to authenticating with a GitHub App
		const token = getInput('token') ?? (await getAuthenticationToken());
		return token;
	}

	getRepoName() {
		return getInput('repo') ?? context.repo.repo;
	}

	getRepoOwner() {
		return getInput('owner') ?? context.repo.owner;
	}

	getIssueNumber() {
		const issueNumber = +(getInput('issue_number') ?? 0);
		return (
			(issueNumber > 0 ? issueNumber : undefined) ??
			context.issue?.number ??
			context.payload.issue?.number
		);
	}

	getAssignee(): string {
		const payload = getInput('payload');
		let assignee = '';
		if (payload) {
			assignee = JSON.parse(payload).assignee;
		} else {
			assignee = context.payload.assignee.login;
		}
		return assignee;
	}

	getComment() {
		const payload = getInput('comment');
		let comment = '';
		if (payload) {
			comment = JSON.parse(payload)?.body;
		} else {
			comment = context.payload.comment?.body;
		}
		return comment;
	}

	getCommentAuthor() {
		const payload = getInput('comment');
		let author = '';
		if (payload) {
			author = JSON.parse(payload).user?.login;
		} else {
			author = context.payload.comment?.user?.login;
		}
		return author;
	}

	getLabel() {
		const payload = getInput('payload');
		let label = '';
		if (payload) {
			label = JSON.parse(payload).label;
		} else {
			label = context.payload.label?.name;
		}
		return label;
	}

	public async run() {
		if (errorLoggingIssue) {
			const errorIssue = errorLoggingIssue(this.repoName, this.repoOwner);
			if (
				this.repoName === errorIssue?.repo &&
				this.repoOwner === errorIssue.owner &&
				this.issue === errorIssue.issue
			) {
				return safeLog('refusing to run on error logging issue to prevent cascading errors');
			}
		}

		try {
			const token = await this.getToken();
			const readonly = !!getInput('readonly');
			const event = getInput('event') ?? context.eventName;
			if (this.issue) {
				const octokit = new OctoKitIssue(
					token,
					{ repo: this.repoName, owner: this.repoOwner },
					{ number: this.issue },
					{ readonly },
				);
				if (event === 'issue_comment') {
					await this.onCommented(octokit, this.getComment(), this.getCommentAuthor());
				} else if (
					event === 'issues' ||
					event === 'pull_request' ||
					event === 'pull_request_target'
				) {
					const action = getInput('action') ?? context.payload.action;
					switch (action) {
						case 'opened':
						case 'ready_for_review':
							await this.onOpened(octokit, context.payload);
							break;
						case 'reopened':
							await this.onReopened(octokit);
							break;
						case 'closed':
							await this.onClosed(octokit, context.payload);
							break;
						case 'labeled':
							await this.onLabeled(octokit, this.getLabel());
							break;
						case 'assigned':
							await this.onAssigned(octokit, this.getAssignee());
							break;
						case 'unassigned':
							await this.onUnassigned(octokit, this.getAssignee());
							break;
						case 'edited':
							await this.onEdited(octokit);
							break;
						case 'milestoned':
							await this.onMilestoned(octokit);
							break;
						case 'converted_to_draft':
							await this.onConvertedToDraft(octokit, context.payload);
							break;
						default:
							throw Error('Unexpected action: ' + action);
					}
				}
			} else if (event === 'create') {
				await this.onCreated(
					new OctoKit(token, { repo: this.repoName, owner: this.repoOwner }, { readonly }),
					context?.payload?.ref,
					context?.payload?.sender?.login,
				);
			} else {
				await this.onTriggered(
					new OctoKit(token, { repo: this.repoName, owner: this.repoOwner }, { readonly }),
				);
			}
		} catch (e) {
			const err = e as Error;
			safeLog(err?.stack || err?.message || String(e));
			try {
				await this.error(err);
			} catch {
				// Always fail the action even if we don't properly log it to the issue
				setFailed(err.message);
			}
		}
	}

	private async error(error: Error) {
		const token = await this.getToken();
		const username = getOctokit(token)
			.rest.users.getAuthenticated()
			.then(
				(v) => v.data.name ?? 'unknown',
				() => 'unknown',
			);

		const details: any = {
			message: `${error.message}\n${error.stack}`,
			id: this.id,
			user: await username,
		};

		if (this.issue) {
			details.issue = this.issue;
		}

		const rendered = `
Message: ${details.message}

Actor: ${details.user}

ID: ${details.id}
`;
		await logErrorToIssue(rendered, true, token, this.repoName, this.repoOwner);

		setFailed(error.message);
	}

	protected async onTriggered(_octokit: OctoKit): Promise<void> {
		throw Error('not implemented');
	}
	protected async onCreated(_octokit: OctoKit, _ref: string, _creator: string): Promise<void> {
		throw Error('not implemented');
	}
	protected async onEdited(_issue: OctoKitIssue): Promise<void> {
		throw Error('not implemented');
	}
	protected async onLabeled(_issue: OctoKitIssue, _label: string): Promise<void> {
		throw Error('not implemented');
	}
	protected async onAssigned(_issue: OctoKitIssue, _assignee: string): Promise<void> {
		throw Error('not implemented');
	}
	protected async onUnassigned(_issue: OctoKitIssue, _assignee: string): Promise<void> {
		throw Error('not implemented');
	}
	protected async onOpened(_issue: OctoKitIssue, _payload: WebhookPayload): Promise<void> {
		throw Error('not implemented');
	}
	protected async onReopened(_issue: OctoKitIssue): Promise<void> {
		throw Error('not implemented');
	}
	protected async onClosed(_issue: OctoKitIssue, _payload: WebhookPayload): Promise<void> {
		throw Error('not implemented');
	}
	protected async onConvertedToDraft(_issue: OctoKitIssue, _payload: WebhookPayload): Promise<void> {
		throw Error('not implemented');
	}
	protected async onMilestoned(_issue: OctoKitIssue): Promise<void> {
		throw Error('not implemented');
	}
	protected async onCommented(_issue: OctoKitIssue, _comment: string, _actor: string): Promise<void> {
		throw Error('not implemented');
	}
}

export async function getAuthenticationToken(): Promise<string> {
	const appId = getInput('app_id');
	const installationId = getInput('app_installation_id');
	const privateKey = getInput('app_private_key');
	if (appId && installationId && privateKey) {
		const maxAttempts = 3;
		let attempts = 0;

		while (attempts < maxAttempts) {
			try {
				const appAuth = createAppAuth({ appId, installationId, privateKey });
				return (await appAuth({ type: 'installation' })).token;
			} catch (error: any) {
				if (error.response && error.response.status === 504) {
					attempts++;
					const delay = Math.pow(2, attempts) * 1000; // Exponential backoff
					safeLog(
						`Attempt ${attempts} failed with 504 error. Retrying in ${delay / 1000} seconds.`,
					);
					if (attempts >= maxAttempts) {
						throw new Error('Max retry attempts reached. Please try again later');
					}
					await new Promise((resolve) => setTimeout(resolve, delay));
				} else {
					throw error;
				}
			}
		}
	}
	throw Error('Failed to get authentication token');
}
