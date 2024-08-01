/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSCodeToolsAPIManager } from '../api/vscodeTools';
import { Action } from '../common/Action';
import { getRequiredInput } from '../common/utils';
import { ReviewReminder } from './ReviewReminder';

const slackToken = getRequiredInput('slack_token');

class ReviewReminderAction extends Action {
	id = 'ReviewReminder';

	async onTriggered() {
		const auth = await this.getToken();
		await new ReviewReminder(auth, slackToken, new VSCodeToolsAPIManager()).run();
	}
}

new ReviewReminderAction().run() // eslint-disable-line
