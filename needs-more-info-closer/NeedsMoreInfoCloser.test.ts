/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { Comment, Query } from '../api/api';
import { Testbed, TestbedIssueConstructorArgs } from '../api/testbed';
import { NeedsMoreInfoCloser } from './NeedsMoreInfoCloser';
import { daysAgoToTimestamp } from '../common/utils';

describe('NeedsMoreInfoCloser', () => {
	it('creates a reasonable query and closes the issues the query yields, but only if the last comment was a bot or contributor', async () => {
		const teamComment: () => Comment = () => ({
			author: { name: 'JacksonKearl' },
			body: 'Hello i am a team member',
			id: 0,
			timestamp: 0,
		});
		const contributorComment: () => Comment = () => ({
			author: { name: 'jax' },
			body: 'Hello i am a contributor',
			id: 0,
			timestamp: 0,
		});
		const botComment: () => Comment = () => ({
			author: { name: 'dependabot', isGitHubApp: true },
			body: 'hello i am a github app',
			id: 0,
			timestamp: 0,
		});
		const otherComment: () => Comment = () => ({
			author: { name: 'AlohaJax' },
			body: 'hello i am a rando',
			id: 0,
			timestamp: 0,
		});

		const issuesToClose: TestbedIssueConstructorArgs[] = [
			{ comments: [], labels: ['info-needed'] },
			{ comments: [botComment()], labels: ['info-needed'] },
			{ comments: [contributorComment()], labels: ['info-needed'] },
			{ comments: [teamComment()], labels: ['info-needed'] },
			{ comments: [otherComment(), botComment()], labels: ['info-needed'] },
			{ comments: [otherComment(), contributorComment()], labels: ['info-needed'] },
			{ comments: [otherComment(), teamComment()], labels: ['info-needed'] },
		];

		const issuesNotToClose: TestbedIssueConstructorArgs[] = [
			{ comments: [otherComment()], labels: ['info-needed'] },
			{ comments: [contributorComment(), otherComment()], labels: ['info-needed'] },
			{ comments: [teamComment(), otherComment()], labels: ['info-needed'] },
			{ comments: [botComment(), otherComment()], labels: ['info-needed'] },
		];

		const issuesToPing: TestbedIssueConstructorArgs[] = [
			{
				issue: { updatedAt: daysAgoToTimestamp(3), assignee: 'jax' },
				comments: [otherComment()],
				labels: ['info-needed'],
			},
			{
				issue: { updatedAt: daysAgoToTimestamp(3), assignee: 'jax' },
				comments: [contributorComment(), otherComment()],
				labels: ['info-needed'],
			},
			{
				issue: { updatedAt: daysAgoToTimestamp(3), assignee: 'jax' },
				comments: [botComment(), otherComment()],
				labels: ['info-needed'],
			},
		];

		const queryRunner = async function* (
			_query: Query,
		): AsyncIterableIterator<TestbedIssueConstructorArgs[]> {
			yield [...issuesToClose, ...issuesNotToClose, ...issuesToPing];
		};

		const testbed = new Testbed({ queryRunner, writers: ['JacksonKearl'] });
		await new NeedsMoreInfoCloser(
			testbed,
			'info-needed',
			1,
			2,
			'closed this because it needs more info thx :)',
			'please check this issue out',
			['jax'],
		).run();
		issuesToClose.map(
			(issue) =>
				expect(issue.issue?.open, issue.comments?.map((comment) => comment.body).join(',')).to.be
					.false,
		);
		issuesNotToClose.map(
			(issue) =>
				expect(issue.issue?.open, issue.comments?.map((comment) => comment.body).join(',')).to.be
					.true,
		);
		issuesToPing.map((issue) => {
			expect(issue.issue?.open, issue.comments?.map((comment) => comment.body).join(',')).to.be.true;
			expect(issue.comments?.map((comment) => comment.body).join(',')).to.contain('please check');
		});
	});
});
