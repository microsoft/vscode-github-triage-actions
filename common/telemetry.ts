/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { context } from '@actions/github';
import * as appInsights from 'applicationinsights';
import { getInput } from './utils';
import { GitHubIssue } from '../api/api';

let _aiHandle: appInsights.TelemetryClient | undefined = undefined;
const aiKey = getInput('appInsightsKey');
if (aiKey) {
	appInsights
		.setup(aiKey)
		.setAutoDependencyCorrelation(false)
		.setAutoCollectRequests(false)
		.setAutoCollectPerformance(false, false)
		.setAutoCollectExceptions(false)
		.setAutoCollectDependencies(false)
		.setAutoCollectConsole(false)
		.setUseDiskRetryCaching(false)
		.start();
	_aiHandle = appInsights.defaultClient;
}

export const aiHandle = _aiHandle;
export const trackEvent = async (issue: GitHubIssue, event: string, props?: Record<string, string>) => {
	if (aiHandle) {
		aiHandle.trackEvent({
			name: event,
			properties: {
				repo: `${context.repo.owner}/${context.repo.repo}`,
				issue: '' + (await issue.getIssue()).number,
				workflow: context.workflow,
				...props,
			},
		});
	}
};
