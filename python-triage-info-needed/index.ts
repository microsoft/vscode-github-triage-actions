// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { context } from '@actions/github';
import { OctoKitIssue } from '../api/octokit';
import { Action } from '../common/Action';
import { getRequiredInput } from '../common/utils';

class TriageInfoNeeded extends Action {
	id = 'TriageInfoNeeded';

	async onCommented(octoKitIssue: OctoKitIssue) {
		const action = getRequiredInput('action');
		const github = octoKitIssue.octokit;
		if (action === 'add') {
			await this.addLabel(github);
		} else {
			await this.removeLabel(github);
		}
	}

	private async addLabel(github: OctoKitIssue['octokit']) {
		const issue = await github.rest.issues.get({
			owner: context.repo.owner,
			repo: context.repo.repo,
			issue_number: context.issue.number,
		});
		const commentAuthor = context.payload.comment!.user.login;
		const commentBody = context.payload.comment!.body;
		const isTeamMember = JSON.parse(getRequiredInput('triagers')).includes(commentAuthor);

		const keywords = JSON.parse(getRequiredInput('keywords'));
		const isRequestForInfo = new RegExp(keywords.join('|'), 'i').test(commentBody);

		const shouldAddLabel = isTeamMember && commentAuthor !== issue.data.user!.login && isRequestForInfo;

		if (shouldAddLabel) {
			await github.rest.issues.addLabels({
				owner: context.repo.owner,
				repo: context.repo.repo,
				issue_number: context.issue.number,
				labels: ['info-needed'],
			});
		}
	}

	private async removeLabel(github: OctoKitIssue['octokit']) {
		const issue = await github.rest.issues.get({
			owner: context.repo.owner,
			repo: context.repo.repo,
			issue_number: context.issue.number,
		});
		const commentAuthor = context.payload.comment!.user.login;
		const issueAuthor = issue.data.user!.login;
		if (commentAuthor === issueAuthor) {
			await github.rest.issues.removeLabel({
				owner: context.repo.owner,
				repo: context.repo.repo,
				issue_number: context.issue.number,
				name: 'info-needed',
			});
			return;
		}
		if (JSON.parse(getRequiredInput('triagers')).includes(commentAuthor)) {
			// If one of triagers made a comment, ignore it
			return;
		}
		// Loop through all the comments on the issue in reverse order and find the last username that a TRIAGER mentioned
		// If the comment author is the last mentioned username, remove the "info-needed" label
		const comments = await github.rest.issues.listComments({
			owner: context.repo.owner,
			repo: context.repo.repo,
			issue_number: context.issue.number,
		});
		for (const comment of comments.data.slice().reverse()) {
			if (!JSON.parse(getRequiredInput('triagers')).includes(comment.user!.login)) {
				continue;
			}
			const matches = comment.body!.match(/@\w+/g) || [];
			const mentionedUsernames = matches.map((match) => match.replace('@', ''));
			if (mentionedUsernames.includes(commentAuthor)) {
				await github.rest.issues.removeLabel({
					owner: context.repo.owner,
					repo: context.repo.repo,
					issue_number: context.issue.number,
					name: 'info-needed',
				});
				break;
			}
		}
	}
}

new TriageInfoNeeded().run(); // eslint-disable-line
