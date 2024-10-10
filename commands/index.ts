/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PayloadRepository } from '@actions/github/lib/interfaces';
import { Issue } from '../api/api';
import { OctoKitIssue } from '../api/octokit';
import { Action } from '../common/Action';
import { getRequiredInput } from '../common/utils';
import { Commands } from './Commands';

const repository: PayloadRepository = JSON.parse(getRequiredInput('repository'));

const hydrate = (comment: string, issue: Issue) => {
	const baseQueryString = `https://github.com/${repository.owner.login}/${repository.name}/issues?utf8=%E2%9C%93&q=is%3Aopen+is%3Aissue+`;
	const importantLabels = issue.labels.filter((label) => label !== '*duplicate');
	const labelsQueryString = encodeURIComponent(
		importantLabels.map((label) => `label:"${label}"`).join(' '),
	);
	const url = baseQueryString + labelsQueryString;
	return comment.replace('${duplicateQuery}', url).replace('${author}', issue.author.name);
};

class CommandsRunner extends Action {
	id = 'Commands';

	async onCommented(issue: OctoKitIssue, comment: string, actor: string) {
		const commands = await issue.readConfig(getRequiredInput('config-path'));
		await new Commands(issue, commands, { comment, user: { name: actor } }, hydrate).run();
	}

	async onLabeled(issue: OctoKitIssue, label: string) {
		const commands = await issue.readConfig(getRequiredInput('config-path'));
		await new Commands(issue, commands, { label }, hydrate).run();
	}

	protected override async onTriggered() {
		// This function is only called during a manual workspace dispatch event
		// caused by a webhook, so we know to expect some inputs.
		const auth = await this.getToken();
		const event = getRequiredInput('event');
		const issue = JSON.parse(getRequiredInput('issue'));

		const octokitIssue = new OctoKitIssue(
			auth,
			{ owner: repository.owner.login, repo: repository.name },
			{ number: issue.number },
		);

		if (event === 'issue_comment') {
			const commentObject = JSON.parse(getRequiredInput('comment'));
			const comment = commentObject.body;
			const actor = commentObject.user.login;
			const commands = await octokitIssue.readConfig(
				getRequiredInput('config-path'),
				'vscode-engineering',
			);
			await new Commands(octokitIssue, commands, { comment, user: { name: actor } }, hydrate).run();
		} else if (event === 'issues') {
			const action = getRequiredInput('action');
			if (action !== 'labeled') {
				return;
			}

			for (const label of issue.labels) {
				const commands = await octokitIssue.readConfig(
					getRequiredInput('config-path'),
					'vscode-engineering',
				);
				await new Commands(octokitIssue, commands, { label: label.name }, hydrate).run();
			}
		}
		return;
	}
}

new CommandsRunner().run(); // eslint-disable-line
