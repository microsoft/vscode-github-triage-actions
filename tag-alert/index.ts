/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getRequiredInput } from '../common/utils';
import { Action } from '../common/Action';
import { OctoKit } from '../api/octokit';

class TagAlert extends Action {
	id = 'TagAlert';

	async onCreated(_github: OctoKit, ref: string, creator: string): Promise<void> {
		if (getRequiredInput('tag-name') === ref) {
			throw Error(`Warning: @${creator} pushed bad tag ${ref}`);
		}
	}
}

new TagAlert().run() // eslint-disable-line
