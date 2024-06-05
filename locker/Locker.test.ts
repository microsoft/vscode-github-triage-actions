/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { Query } from '../api/api';
import { Testbed, TestbedIssueConstructorArgs } from '../api/testbed';
import { Locker } from './Locker';

describe('Locker', () => {
	it('creates a reasonable query and locks the issues the query yields', async () => {
		const issue: TestbedIssueConstructorArgs = {
			issue: {
				open: false,
				locked: false,
			},
		};

		const queryRunner = async function* (
			query: Query,
		): AsyncIterableIterator<TestbedIssueConstructorArgs[]> {
			expect(query.q).to.contain('closed');
			yield [issue];
		};

		const testbed = new Testbed({ queryRunner });
		expect(issue?.issue?.locked).to.be.false;
		await new Locker(testbed, 10, 1).run();
		expect(issue?.issue?.locked).to.be.true;
	});

	it('observes the exclude label if present', async () => {
		const queryRunner = async function* (
			query: Query,
		): AsyncIterableIterator<TestbedIssueConstructorArgs[]> {
			expect(query.q).to.contain('-label:exclude');
			yield [];
		};

		const testbed = new Testbed({ queryRunner });
		await new Locker(testbed, 10, 1, 'exclude').run();
	});

	it('observes the exclude until label if present', async () => {
		const issue: TestbedIssueConstructorArgs = {
			issue: {
				open: false,
				locked: false,
			},
			labels: ['authorVerificationRequested'],
		};

		const queryRunner = async function* (): AsyncIterableIterator<TestbedIssueConstructorArgs[]> {
			yield [issue];
		};

		const testbed = new Testbed({ queryRunner });
		expect(issue?.issue?.locked).to.be.false;
		await new Locker(testbed, 10, 1, 'exclude', 'authorVerificationRequested', undefined, 'verify').run();
		expect(issue?.issue?.locked).to.be.false;
		issue.labels?.push('verify');
		await new Locker(testbed, 10, 1, 'exclude', 'authorVerificationRequested', undefined, 'verify').run();
		expect(issue?.issue?.locked).to.be.true;
	});

	it('locks issues that do not contain exclude label', async () => {
		const issue: TestbedIssueConstructorArgs = {
			issue: {
				open: false,
				locked: false,
			},
			labels: [],
		};

		const queryRunner = async function* (): AsyncIterableIterator<TestbedIssueConstructorArgs[]> {
			yield [issue];
		};

		const testbed = new Testbed({ queryRunner });
		expect(issue?.issue?.locked).to.be.false;
		await new Locker(testbed, 10, 1, 'exclude', 'authorVerificationRequested', 'verify').run();
		expect(issue?.issue?.locked).to.be.true;
	});

	it('does not lock pull requests if the type is set to "issue"', async () => {
		const issue: TestbedIssueConstructorArgs = {
			issue: {
				number: 1,
				open: false,
				locked: false,
			},
			labels: [],
		};

		const pr: TestbedIssueConstructorArgs = {
			issue: {
				number: 2,
				open: false,
				locked: false,
				isPr: true,
			},
			labels: [],
		};

		const queryRunner = async function* (): AsyncIterableIterator<TestbedIssueConstructorArgs[]> {
			yield [issue, pr];
		};

		const testbed = new Testbed({ queryRunner });
		expect(issue?.issue?.locked).to.be.false;
		expect(pr?.issue?.locked).to.be.false;

		await new Locker(testbed, 10, 1, undefined, undefined, undefined, undefined, 'issue').run();
		expect(issue?.issue?.locked).to.be.true;
		expect(pr?.issue?.locked).to.be.false;
	});

	it('does not lock issues if the type is set to "pr"', async () => {
		const issue: TestbedIssueConstructorArgs = {
			issue: {
				number: 1,
				open: false,
				locked: false,
			},
			labels: [],
		};

		const pr: TestbedIssueConstructorArgs = {
			issue: {
				number: 2,
				open: false,
				locked: false,
				isPr: true,
			},
			labels: [],
		};

		const queryRunner = async function* (): AsyncIterableIterator<TestbedIssueConstructorArgs[]> {
			yield [issue, pr];
		};

		const testbed = new Testbed({ queryRunner });
		expect(issue?.issue?.locked).to.be.false;
		expect(pr?.issue?.locked).to.be.false;

		await new Locker(testbed, 10, 1, undefined, undefined, undefined, undefined, 'pr').run();
		expect(issue?.issue?.locked).to.be.false;
		expect(pr?.issue?.locked).to.be.true;
	});

	it('does not lock issues in the ignoredMilestone', async () => {
		const issue: TestbedIssueConstructorArgs = {
			issue: {
				number: 1,
				open: false,
				locked: false,
				milestone: {
					milestoneId: 7,
					title: 'milestone title',
					description: 'test milestone desc',
					dueOn: new Date(),
					numClosedIssues: 0,
					numOpenIssues: 0,
					state: 'open',
					closedAt: new Date(),
					createdAt: new Date(),
				},
			},
			labels: [],
		};

		const queryRunner = async function* (): AsyncIterableIterator<TestbedIssueConstructorArgs[]> {
			yield [issue];
		};

		const testbed = new Testbed({ queryRunner });
		expect(issue?.issue?.locked).to.be.false;

		await new Locker(testbed, 10, 1, undefined, undefined, 'milestone title', undefined, undefined).run();
		expect(issue?.issue?.locked).to.be.false;
		await new Locker(testbed, 10, 1, undefined, undefined, 'other milestone', undefined, undefined).run();
		expect(issue?.issue?.locked).to.be.true;
	});
});
