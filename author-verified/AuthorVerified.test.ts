/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect } from 'chai'
import * as nock from 'nock'
import { TestbedIssue } from '../api/testbed'
import { AuthorVerifiedLabeler } from './AuthorVerified'

const setup = () =>
	nock('https://vscode-update.azurewebsites.net')
		.get('/api/update/darwin/insider/latest')
		.reply(200, { version: 'hash', timestamp: 0 })

describe('AuthorVerified', () => {
	it('Does nothing to issues which have not yet been closed', async () => {
		const testbed = new TestbedIssue({}, { labels: ['verify-plz'] })
		await new AuthorVerifiedLabeler(
			testbed,
			'plz verify thx',
			'pending-release',
			'verify-plz',
			'verified',
		).run()
		expect((await testbed.getIssue()).labels).not.to.contain('pending-release')
	})

	it('Does nothing to issues which arent labeled', async () => {
		const testbed = new TestbedIssue({}, { labels: [], issue: { open: false } })
		await new AuthorVerifiedLabeler(
			testbed,
			'plz verify thx',
			'pending-release',
			'verify-plz',
			'verified',
		).run()
		expect((await testbed.getIssue()).labels).not.to.contain('pending-release')
	})

	it('Comments an error on issues which are labeled and closed but not closed with a commit', async () => {
		setup()
		const testbed = new TestbedIssue(
			{},
			{
				labels: ['verify-plz'],
				closingCommit: undefined,
				issue: { open: false },
			},
		)
		await new AuthorVerifiedLabeler(
			testbed,
			'plz verify thx',
			'pending-release',
			'verify-plz',
			'verified',
		).run()

		expect((await testbed.getIssue()).labels).not.to.contain('verify-plz')

		const comments = []
		for await (const page of testbed.getComments()) {
			comments.push(...page)
		}

		expect(comments[0].body).to.contain('Unable to locate closing commit in issue timeline')
	})

	it('Adds pending label to issues which are closed with a commit and labeled but not released', async () => {
		setup()
		const testbed = new TestbedIssue(
			{},
			{
				labels: ['verify-plz'],
				closingCommit: { hash: 'commit', timestamp: 0 },
				issue: { open: false },
			},
		)
		await new AuthorVerifiedLabeler(
			testbed,
			'plz verify thx',
			'pending-release',
			'verify-plz',
			'verified',
		).run()
		expect((await testbed.getIssue()).labels).to.contain('pending-release')
	})

	it('Adds comment to issues which are closed with a commit and labeled and released', async () => {
		setup()
		const testbed = new TestbedIssue(
			{ releasedCommits: ['commit'] },
			{
				labels: ['verify-plz', 'pending-release'],
				closingCommit: { hash: 'commit', timestamp: 0 },
				issue: { open: false },
			},
		)
		await new AuthorVerifiedLabeler(
			testbed,
			'plz verify thx',
			'pending-release',
			'verify-plz',
			'verified',
		).run()
		expect((await testbed.getIssue()).labels).not.to.contain('pending-release')

		const comments = []
		for await (const page of testbed.getComments()) {
			comments.push(...page)
		}
		expect(comments[0].body).to.equal('plz verify thx')
	})

	it('Does not add comment to issues which are verified already', async () => {
		setup()
		const testbed = new TestbedIssue(
			{ releasedCommits: ['commit'] },
			{
				labels: ['verify-plz', 'pending-release', 'verified'],
				closingCommit: { hash: 'commit', timestamp: 0 },
				issue: { open: false },
			},
		)
		await new AuthorVerifiedLabeler(
			testbed,
			'plz verify thx',
			'pending-release',
			'verify-plz',
			'verified',
		).run()
		expect((await testbed.getIssue()).labels).not.to.contain('pending-release')

		const comments = []
		for await (const page of testbed.getComments()) {
			comments.push(...page)
		}
		expect(comments[0]?.body).not.to.equal('plz verify thx')
	})
})
