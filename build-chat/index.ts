/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Octokit } from '@octokit/rest'
import { getInput, getRequiredInput } from '../common/utils'
import { buildChat } from './BuildChat'
import { Action } from '../common/Action'

class BuildChatAction extends Action {
	id = 'BuildChat'

	async onTriggered() {
		const slackToken = getRequiredInput('slack_token')
		if (!slackToken) {
			return
		}
		const auth = getRequiredInput('token')
		const github = new Octokit({ auth })
		await buildChat(github, getRequiredInput('workflow_run_url'), {
			slackToken,
			storageConnectionString: getInput('storage_connection_string') || undefined,
			notifyAuthors: getInput('notify_authors') === 'true',
			notificationChannel: getInput('notification_channel') || undefined,
			logChannel: getInput('log_channel') || undefined,
		})
	}
}

new BuildChatAction().run() // eslint-disable-line
