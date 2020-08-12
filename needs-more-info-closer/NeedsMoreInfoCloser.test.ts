/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect } from 'chai'
import { Comment, Query } from '../api/api'
import { Testbed, TestbedIssueConstructorArgs } from '../api/testbed'
import { NeedsMoreInfoCloser } from './NeedsMoreInfoCloser'
import { daysAgoToTimestamp } from '../common/utils'

describe('NeedsMoreInfoCloser', () => {
	it('creates a reasonable query and closes the issues the query yields, but only if the last comment was a bot or contributor', async () => {
		const teamComment: () => Comment = () => ({
			author: { name: 'JacksonKearl' },
			body: 'Hello i am a team member',
			id: 0,
			timestamp: 0,
		})
		const contributorComment: () => Comment = () => ({
			author: { name: 'jax' },
			body: 'Hello i am a contributor',
			id: 0,
			timestamp: 0,
		})
		const botComment: () => Comment = () => ({
			author: { name: 'dependabot', isGitHubApp: true },
			body: 'hello i am a github app',
			id: 0,
			timestamp: 0,
		})
		const otherComment: () => Comment = () => ({
			author: { name: 'AlohaJax' },
			body: 'hello i am a rando',
			id: 0,
			timestamp: 0,
		})

		const issuesToClose: TestbedIssueConstructorArgs[] = [
			{ comments: [], labels: ['needs more info'] },
			{ comments: [botComment()], labels: ['needs more info'] },
			{ comments: [contributorComment()], labels: ['needs more info'] },
			{ comments: [teamComment()], labels: ['needs more info'] },
			{ comments: [otherComment(), botComment()], labels: ['needs more info'] },
			{ comments: [otherComment(), contributorComment()], labels: ['needs more info'] },
			{ comments: [otherComment(), teamComment()], labels: ['needs more info'] },
		]

		const issuesNotToClose: TestbedIssueConstructorArgs[] = [
			{ comments: [otherComment()], labels: ['needs more info'] },
			{ comments: [contributorComment(), otherComment()], labels: ['needs more info'] },
			{ comments: [teamComment(), otherComment()], labels: ['needs more info'] },
			{ comments: [botComment(), otherComment()], labels: ['needs more info'] },
		]

		const issuesToPing: TestbedIssueConstructorArgs[] = [
			{
				issue: { updatedAt: daysAgoToTimestamp(3), assignee: 'jax' },
				comments: [otherComment()],
				labels: ['needs more info'],
			},
			{
				issue: { updatedAt: daysAgoToTimestamp(3), assignee: 'jax' },
				comments: [contributorComment(), otherComment()],
				labels: ['needs more info'],
			},
			{
				issue: { updatedAt: daysAgoToTimestamp(3), assignee: 'jax' },
				comments: [botComment(), otherComment()],
				labels: ['needs more info'],
			},
		]

		const queryRunner = async function* (
			_query: Query,
		): AsyncIterableIterator<TestbedIssueConstructorArgs[]> {
			yield [...issuesToClose, ...issuesNotToClose, ...issuesToPing]
		}

		const testbed = new Testbed({ queryRunner, writers: ['JacksonKearl'] })
		await new NeedsMoreInfoCloser(
			testbed,
			'needs more info',
			1,
			2,
			'closed this because it needs more info thx :)',
			'please check this issue out',
			['jax'],
		).run()
		issuesToClose.map(
			(issue) =>
				expect(issue.issue?.open, issue.comments?.map((comment) => comment.body).join(',')).to.be
					.false,
		)
		issuesNotToClose.map(
			(issue) =>
				expect(issue.issue?.open, issue.comments?.map((comment) => comment.body).join(',')).to.be
					.true,
		)
		issuesToPing.map((issue) => {
			expect(issue.issue?.open, issue.comments?.map((comment) => comment.body).join(',')).to.be.true
			expect(issue.comments?.map((comment) => comment.body).join(',')).to.contain('please check')
		})
	})
})
