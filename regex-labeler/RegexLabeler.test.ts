/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { TestbedIssue } from '../api/testbed';
import { RegexFlagger } from './RegexLabeler';

describe('NeedsMoreInfoLabeler', () => {
	it('Doesnt flag issues that dont match mustNotMatch', async () => {
		const issue = new TestbedIssue({}, { issue: { body: 'hello' } });
		await new RegexFlagger(issue, undefined, undefined, undefined, 'goodbye').run();
		expect(issue.issueConfig.issue.open).to.be.true;
	});

	it('Doesnt flag issues that match mustMatch', async () => {
		const issue = new TestbedIssue({}, { issue: { body: 'hello' } });
		await new RegexFlagger(issue, undefined, undefined, 'hello', undefined).run();
		expect(issue.issueConfig.issue.open).to.be.true;
	});

	it('Flags issues that dont match mustMatch', async () => {
		const issue = new TestbedIssue({}, { issue: { body: 'goodbye' } });
		await new RegexFlagger(issue, undefined, undefined, 'hello', undefined).run();
		expect(issue.issueConfig.issue.open).to.be.false;
	});

	it('Flags issues that match mustNotMatch', async () => {
		const issue = new TestbedIssue(
			{},
			{
				issue: {
					body: 'We have written the needed data into your clipboard because it was too large to send. Please paste.',
				},
			},
		);
		await new RegexFlagger(
			issue,
			undefined,
			undefined,
			undefined,
			'^We have written the needed data into your clipboard because it was too large to send\\. Please paste\\.$',
		).run();
		expect(issue.issueConfig.issue.open).to.be.false;
	});
});
