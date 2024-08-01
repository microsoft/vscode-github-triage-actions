/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OctoKit } from '../api/octokit';
import { Action } from '../common/Action';
import { getRequiredInput } from '../common/utils';

class TagAlert extends Action {
	id = 'TagAlert';

	async onCreated(_github: OctoKit, ref: string, creator: string): Promise<void> {
		if (getRequiredInput('tag-name') === ref) {
			throw Error(`Warning: @${creator} pushed bad tag ${ref}`);
		}
	}
}

// Test
new TagAlert().run() // eslint-disable-line
