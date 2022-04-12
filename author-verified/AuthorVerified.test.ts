/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect } from 'chai'
import * as nock from 'nock'
import { Comment } from '../api/api'
import { TestbedIssue } from '../api/testbed'
import { AuthorVerifiedLabeler } from './AuthorVerified'

const setup = () =>
	nock('https://update.code.visualstudio.com')
		.get('/api/update/darwin/insider/latest')
		.reply(200, { version: 'hash', timestamp: 0 })

describe('AuthorVerified', () => {
	it('Does nothing to issues which have not yet been closed', async () => {
		const testbed = new TestbedIssue({}, { labels: ['verify-plz'] })
		await new AuthorVerifiedLabeler(testbed, 'plz verify thx', 'released', 'verify-plz', 'verified').run()
		const comments: Comment[] = []
		for await (const page of testbed.getComments()) {
			comments.push(...page)
		}
		expect(comments[0]?.body).to.be.undefined
	})

	it('Does nothing to issues which arent labeled', async () => {
		const testbed = new TestbedIssue({}, { labels: [], issue: { open: false } })
		await new AuthorVerifiedLabeler(testbed, 'plz verify thx', 'released', 'verify-plz', 'verified').run()
		const comments: Comment[] = []
		for await (const page of testbed.getComments()) {
			comments.push(...page)
		}
		expect(comments[0]?.body).to.be.undefined
	})

	it('Does nothing to issues which have not yet been released', async () => {
		const testbed = new TestbedIssue({}, { labels: ['verify-plz'], issue: { open: false } })
		await new AuthorVerifiedLabeler(testbed, 'plz verify thx', 'released', 'verify-plz', 'verified').run()
		const comments: Comment[] = []
		for await (const page of testbed.getComments()) {
			comments.push(...page)
		}
		expect(comments[0]?.body).to.be.undefined
	})

	it('Does nothing to issues which have not been marked verifiable', async () => {
		const testbed = new TestbedIssue({}, { labels: ['released'], issue: { open: false } })
		await new AuthorVerifiedLabeler(testbed, 'plz verify thx', 'released', 'verify-plz', 'verified').run()
		const comments: Comment[] = []
		for await (const page of testbed.getComments()) {
			comments.push(...page)
		}
		expect(comments[0]?.body).to.be.undefined
	})

	it('Adds comment to issues which have been released', async () => {
		const testbed = new TestbedIssue({}, { labels: ['verify-plz', 'released'], issue: { open: false } })
		await new AuthorVerifiedLabeler(testbed, 'plz verify thx', 'released', 'verify-plz', 'verified').run()
		const comments: Comment[] = []
		for await (const page of testbed.getComments()) {
			comments.push(...page)
		}
		expect(comments[0]?.body).to.contain('plz verify thx')
	})

	it('Adds comment to issues which are closed with a commit and labeled and released', async () => {
		setup()
		const testbed = new TestbedIssue(
			{ releasedCommits: ['commit'] },
			{
				labels: ['verify-plz', 'released'],
				closingCommit: { hash: 'commit', timestamp: 0 },
				issue: { open: false },
			},
		)
		await new AuthorVerifiedLabeler(testbed, 'plz verify thx', 'released', 'verify-plz', 'verified').run()

		const comments: Comment[] = []
		for await (const page of testbed.getComments()) {
			comments.push(...page)
		}
		expect(comments[0].body).to.contain('plz verify thx')
	})

	it.only('Unlocks the issue', async () => {
		setup()
		const testbed = new TestbedIssue(
			{ releasedCommits: ['commit'] },
			{
				labels: ['verify-plz', 'released'],
				closingCommit: { hash: 'commit', timestamp: 0 },
				issue: { open: false, locked: true },
			},
		)
		await new AuthorVerifiedLabeler(testbed, 'plz verify thx', 'released', 'verify-plz', 'verified').run()

		const comments: Comment[] = []
		for await (const page of testbed.getComments()) {
			comments.push(...page)
		}
		expect(comments[0].body).to.contain('plz verify thx')
		expect(testbed.issueConfig.issue.locked).to.be.false
	})

	it('Does not add comment to issues which are verified already', async () => {
		setup()
		const testbed = new TestbedIssue(
			{ releasedCommits: ['commit'] },
			{
				labels: ['verify-plz', 'released', 'verified'],
				closingCommit: { hash: 'commit', timestamp: 0 },
				issue: { open: false },
			},
		)
		await new AuthorVerifiedLabeler(testbed, 'plz verify thx', 'released', 'verify-plz', 'verified').run()

		const comments: Comment[] = []
		for await (const page of testbed.getComments()) {
			comments.push(...page)
		}
		expect(comments[0]?.body).to.be.undefined
	})
})
