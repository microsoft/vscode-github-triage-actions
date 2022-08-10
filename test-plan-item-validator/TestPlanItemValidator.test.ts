/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { Comment } from '../api/api';
import { TestbedIssue } from '../api/testbed';
import { TestPlanItemValidator } from './TestPlanitemValidator';

const validTestPlanItem = `
Refs: #46696

- [ ] macOS
- [ ] linux
- [ ] windows

Complexity: 4

---

This new API allows extensions to contribute to an environment variable collection that enabled modifying environment variables on a process environment. Currently this is only used in the terminal but the naming is left generic so it could be used by other components.
`;
const invalidTestPlanItem = `
Refs: #46696

- [ ] macOS
- [ ] linux
- [ ] windows

Complexity: 4

This new API allows extensions to contribute to an environment variable collection that enabled modifying environment variables on a process environment. Currently this is only used in the terminal but the naming is left generic so it could be used by other components.
`;

describe('TestPlanItemValidator', () => {
	it('does nothing for valid test plan items', async () => {
		const testbed = new TestbedIssue({}, { issue: { body: validTestPlanItem }, labels: ['tpi'] });
		await new TestPlanItemValidator(testbed, '', '', 'tpi', 'invalid-tpi', 'plz fix').run();

		const comments: Comment[] = [];
		for await (const page of testbed.getComments()) {
			comments.push(...page);
		}
		expect(comments.length).to.equal(0);
		expect(testbed.issueConfig.labels.includes('invalid-tpi')).false;
	});

	it('does nothing for non test plan items', async () => {
		const testbed = new TestbedIssue({}, { issue: { body: invalidTestPlanItem } });
		await new TestPlanItemValidator(testbed, '', '', 'tpi', 'invalid-tpi', 'plz fix').run();

		const comments: Comment[] = [];
		for await (const page of testbed.getComments()) {
			comments.push(...page);
		}
		expect(comments.length).to.equal(0);
	});

	it('adds comment for invalid test plan items', async () => {
		const testbed = new TestbedIssue({}, { issue: { body: invalidTestPlanItem }, labels: ['tpi'] });
		await new TestPlanItemValidator(testbed, '', '', 'tpi', 'invalid-tpi', 'plz fix').run();

		const comments: Comment[] = [];
		for await (const page of testbed.getComments()) {
			comments.push(...page);
		}
		expect(comments.length).to.equal(1);
		expect(comments[0].body.indexOf('plz fix') !== 1).to.be.true;
		expect(comments[0].body.indexOf('Test plan item should have header') !== 1).to.be.true;
		expect(testbed.issueConfig.labels.includes('invalid-tpi')).true;
	});

	it('only adds one comment even on multiple runs', async () => {
		const testbed = new TestbedIssue({}, { issue: { body: invalidTestPlanItem }, labels: ['tpi'] });

		await new TestPlanItemValidator(testbed, '', '', 'tpi', 'invalid-tpi', 'plz fix').run();
		await new TestPlanItemValidator(testbed, '', '', 'tpi', 'invalid-tpi', 'plz fix').run();
		await new TestPlanItemValidator(testbed, '', '', 'tpi', 'invalid-tpi', 'plz fix').run();

		const comments: Comment[] = [];
		for await (const page of testbed.getComments()) {
			comments.push(...page);
		}
		expect(comments.length).to.equal(1);
		expect(comments[0].body.indexOf('plz fix') !== 1).to.be.true;
	});

	it('cleans up after itself once issue has been fixed', async () => {
		const testbed = new TestbedIssue({}, { issue: { body: invalidTestPlanItem }, labels: ['tpi'] });
		await new TestPlanItemValidator(testbed, '', '', 'tpi', 'invalid-tpi', 'plz fix').run();

		const comments: Comment[] = [];
		for await (const page of testbed.getComments()) {
			comments.push(...page);
		}
		expect(comments.length).to.equal(1);
		expect(testbed.issueConfig.labels.includes('invalid-tpi')).true;
		expect(testbed.issueConfig.labels.includes('tpi')).false;

		testbed.issueConfig.issue.body = validTestPlanItem;
		await new TestPlanItemValidator(testbed, '', '', 'tpi', 'invalid-tpi', 'plz fix').run();
		const newComments: Comment[] = [];
		for await (const page of testbed.getComments()) {
			newComments.push(...page);
		}
		expect(newComments.length).to.equal(0);
		expect(testbed.issueConfig.labels.includes('invalid-tpi')).false;
		expect(testbed.issueConfig.labels.includes('tpi')).true;
	});
});
