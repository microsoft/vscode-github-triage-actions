/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { setFailed } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { WebhookPayload } from '@actions/github/lib/interfaces';
import { createAppAuth } from '@octokit/auth-app';
import { OctoKit, OctoKitIssue } from '../api/octokit';
import { getInput } from '../common/utils';
import { errorLoggingIssue, logErrorToIssue, safeLog } from './utils';

export abstract class Action {
	abstract id: string;
	repoName: string;
	repoOwner: string;
	issue: number | undefined;

	constructor() {
		// console.log('::stop-commands::' + uuid());
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

			if (this.issue) {
				const octokit = new OctoKitIssue(
					token,
					{ repo: this.repoName, owner: this.repoOwner },
					{ number: this.issue },
					{ readonly },
				);
				if (context.eventName === 'issue_comment') {
					await this.onCommented(octokit, context.payload.comment?.body, context.actor);
				} else if (
					context.eventName === 'issues' ||
					context.eventName === 'pull_request' ||
					context.eventName === 'pull_request_target'
				) {
					switch (context.payload.action) {
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
							await this.onLabeled(octokit, context.payload.label.name);
							break;
						case 'assigned':
							await this.onAssigned(octokit, context.payload.assignee.login);
							break;
						case 'unassigned':
							await this.onUnassigned(octokit, context.payload.assignee.login);
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
							throw Error('Unexpected action: ' + context.payload.action);
					}
				}
			} else if (context.eventName === 'create') {
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
		const appAuth = createAppAuth({ appId, installationId, privateKey });
		return (await appAuth({ type: 'installation' })).token;
	} else {
		throw Error('Input required: app_id, app_installation_id, app_private_key');
	}
}
