/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getRequiredInput } from '../common/utils';
import { Action } from '../common/Action';
import { ReviewReminder } from './ReviewReminder';

const slackToken = getRequiredInput('slack_token');
const auth = getRequiredInput('token');
const connectionString = getRequiredInput('connection_string');

class ReviewReminderAction extends Action {
	id = 'ReviewReminder';

	async onTriggered() {
		await new ReviewReminder(auth, slackToken, connectionString).run();
	}
}

new ReviewReminderAction().run() // eslint-disable-line
