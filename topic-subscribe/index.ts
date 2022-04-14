/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OctoKitIssue } from '../api/octokit';
import { getRequiredInput } from '../common/utils';
import { Action } from '../common/Action';

type Config = { [laabel: string]: string[] };

class SubscribeRunner extends Action {
	id = 'Subscribe';

	async onLabeled(issue: OctoKitIssue, label: string) {
		const subscribe: Config = await issue.readConfig(getRequiredInput('config-path'));
		const config = subscribe?.[label];
		const prefix = `Pinging \`${label}\` topic followers: `;
		if (config) {
			for await (const page of issue.getComments()) {
				if (page.some((comment) => comment.body.includes(prefix))) {
					return;
				}
			}
			await issue.postComment(prefix + config.map((name) => `@${name}`).join(' '));
		}
	}
}

new SubscribeRunner().run() // eslint-disable-line
