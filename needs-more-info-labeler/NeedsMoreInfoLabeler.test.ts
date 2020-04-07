/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect } from 'chai'
import { User } from '../api/api'
import { TestbedIssue } from '../api/testbed'
import { NeedsMoreInfoLabeler } from './NeedsMoreInfoLabeler'

const rando: User = { name: 'UsermcGee' }
const team: User = { name: 'JacksonKearl' }

describe('NeedsMoreInfoLabeler', () => {
	describe('Flagging', () => {
		it('adds label when body is empty and cannot be', async () => {
			const testbed = new TestbedIssue({ writers: ['JacksonKearl'] }, { issue: { author: rando } })
			await new NeedsMoreInfoLabeler(
				testbed,
				'needs-more-info',
				'more info plz',
				'version',
				'TAG',
				[],
			).run()
			const updatedIssue = await testbed.getIssue()
			expect(updatedIssue.labels).to.contain('needs-more-info')

			const comments = []
			for await (const page of testbed.getComments()) {
				comments.push(...page)
			}
			expect(comments[0].body).to.equal('more info plz')
		})

		it('does not double comment', async () => {
			const testbed = new TestbedIssue({ writers: ['JacksonKearl'] }, { issue: { author: rando } })
			await new NeedsMoreInfoLabeler(
				testbed,
				'needs-more-info',
				'more info plz',
				'version',
				'TAG',
				[],
			).run()
			const updatedIssue = await testbed.getIssue()
			expect(updatedIssue.labels).to.contain('needs-more-info')

			await new NeedsMoreInfoLabeler(
				testbed,
				'needs-more-info',
				'more info plz',
				'version',
				'TAG',
				[],
			).run()
			await new NeedsMoreInfoLabeler(
				testbed,
				'needs-more-info',
				'more info plz',
				'version',
				'TAG',
				[],
			).run()
			await new NeedsMoreInfoLabeler(
				testbed,
				'needs-more-info',
				'more info plz',
				'version',
				'TAG',
				[],
			).run()

			const comments = []
			for await (const page of testbed.getComments()) {
				comments.push(...page)
			}
			expect(comments.length).to.equal(1)
		})

		it('does not add label when author is team', async () => {
			const testbed = new TestbedIssue({ writers: ['JacksonKearl'] }, { issue: { author: team } })
			await new NeedsMoreInfoLabeler(
				testbed,
				'needs-more-info',
				'more info plz',
				'version',
				'TAG',
				[],
			).run()
			expect((await testbed.getIssue()).labels).not.to.contain('needs-more-info')
		})

		it('properly searches for regex tags in title (not found)', async () => {
			const testbed = new TestbedIssue(
				{ writers: ['JacksonKearl'] },
				{ issue: { title: 'version : idk', author: rando } },
			)
			await new NeedsMoreInfoLabeler(
				testbed,
				'needs-more-info',
				'more info plz',
				'version\\W*:\\W*\\d.\\d\\d.\\d',
				'TAG',
				[],
			).run()
			expect((await testbed.getIssue()).labels).to.contain('needs-more-info')
		})

		it('properly searches for tags in body comments', async () => {
			const testbed = new TestbedIssue(
				{ writers: ['JacksonKearl'] },
				{ issue: { body: '<!-- TAG -->', author: rando } },
			)
			await new NeedsMoreInfoLabeler(
				testbed,
				'needs-more-info',
				'more info plz',
				'version\\W*:\\W*\\d.\\d\\d.\\d',
				'TAG',
				[],
			).run()
			expect((await testbed.getIssue()).labels).not.to.contain('needs-more-info')
		})

		it('properly searches for regex tags in title (found)', async () => {
			const testbed = new TestbedIssue(
				{ writers: ['JacksonKearl'] },
				{ issue: { title: 'version : 1.42.1', author: rando } },
			)
			await new NeedsMoreInfoLabeler(
				testbed,
				'needs-more-info',
				'more info plz',
				'version\\W*:\\W*\\d.\\d\\d.\\d',
				'TAG',
				[],
			).run()
			expect((await testbed.getIssue()).labels).not.to.contain('needs-more-info')
		})
		it('properly searches for regex tags (not found)', async () => {
			const testbed = new TestbedIssue(
				{ writers: ['JacksonKearl'] },
				{ issue: { body: 'version : idk', author: rando } },
			)
			await new NeedsMoreInfoLabeler(
				testbed,
				'needs-more-info',
				'more info plz',
				'version\\W*:\\W*\\d.\\d\\d.\\d',
				'TAG',
				[],
			).run()
			expect((await testbed.getIssue()).labels).to.contain('needs-more-info')
		})

		it('properly searches for regex tags (found)', async () => {
			const testbed = new TestbedIssue(
				{ writers: ['JacksonKearl'] },
				{ issue: { body: 'version : 1.42.1', author: rando } },
			)
			await new NeedsMoreInfoLabeler(
				testbed,
				'needs-more-info',
				'more info plz',
				'version\\W*:\\W*\\d.\\d\\d.\\d',
				'TAG',
				[],
			).run()
			expect((await testbed.getIssue()).labels).not.to.contain('needs-more-info')
		})

		it('flag-team parameter', async () => {
			const testbed = new TestbedIssue({ writers: ['JacksonKearl'] }, { issue: { author: team } })
			await new NeedsMoreInfoLabeler(
				testbed,
				'needs-more-info',
				'more info plz',
				'version\\W*:\\W*\\d.\\d\\d.\\d',
				'TAG',
				[],
				true,
			).run()
			expect((await testbed.getIssue()).labels).to.contain('needs-more-info')
		})

		it('ignore comments', async () => {
			const testbed = new TestbedIssue(
				{ writers: ['JacksonKearl'] },
				{ issue: { body: '<!-- please try on the latest insiders -->', author: rando } },
			)
			await new NeedsMoreInfoLabeler(
				testbed,
				'needs-more-info',
				'more info plz',
				'insiders',
				'TAG',
				[],
			).run()
			expect((await testbed.getIssue()).labels).to.contain('needs-more-info')
		})
	})

	describe('UnFlagging', () => {
		it('removes the label and its comment on update to the issue if no one else has interacted with the issue', async () => {
			const testbed = new TestbedIssue({ writers: ['JacksonKearl'] }, { issue: { author: rando } })

			{
				await new NeedsMoreInfoLabeler(
					testbed,
					'needs-more-info',
					'more info plz',
					'version',
					'TAG',
					[],
				).run()
				const updatedIssue = await testbed.getIssue()
				expect(updatedIssue.labels).to.contain('needs-more-info')

				const comments = []
				for await (const page of testbed.getComments()) {
					comments.push(...page)
				}
				expect(comments[0].body).to.equal('more info plz')
			}

			testbed.issueConfig.issue.body = 'version'

			{
				await new NeedsMoreInfoLabeler(
					testbed,
					'needs-more-info',
					'more info plz',
					'version',
					'TAG',
					['bot'],
				).run()
				const updatedIssue = await testbed.getIssue()
				expect(updatedIssue.labels).not.to.contain('needs-more-info')

				const comments = []
				for await (const page of testbed.getComments()) {
					comments.push(...page)
				}
				expect(comments[0]).to.be.undefined
			}
		})

		it('removes the label and its comment on update to the issue if only other bots have interacted with the issue', async () => {
			const testbed = new TestbedIssue({ writers: ['JacksonKearl'] }, { issue: { author: rando } })

			{
				await new NeedsMoreInfoLabeler(
					testbed,
					'needs-more-info',
					'more info plz',
					'version',
					'TAG',
					[],
				).run()
				const updatedIssue = await testbed.getIssue()
				expect(updatedIssue.labels).to.contain('needs-more-info')

				const comments = []
				for await (const page of testbed.getComments()) {
					comments.push(...page)
				}
				expect(comments[0].body).to.equal('more info plz')
			}

			testbed.issueConfig.issue.body = 'version'
			await testbed.postComment('hello', 'defo-bot')

			{
				await new NeedsMoreInfoLabeler(
					testbed,
					'needs-more-info',
					'more info plz',
					'version',
					'TAG',
					['bot', 'defo-bot'],
				).run()
				const updatedIssue = await testbed.getIssue()
				expect(updatedIssue.labels).not.to.contain('needs-more-info')

				const comments = []
				for await (const page of testbed.getComments()) {
					comments.push(...page)
				}
				expect(comments[0].body).to.equal('hello')
			}
		})

		it('does not remove the label but does remove the comment on update to the issue if others have interacted with the issue', async () => {
			const testbed = new TestbedIssue({ writers: ['JacksonKearl'] }, { issue: { author: rando } })

			{
				await new NeedsMoreInfoLabeler(
					testbed,
					'needs-more-info',
					'more info plz',
					'version',
					'TAG',
					[],
				).run()
				const updatedIssue = await testbed.getIssue()
				expect(updatedIssue.labels).to.contain('needs-more-info')

				const comments = []
				for await (const page of testbed.getComments()) {
					comments.push(...page)
				}
				expect(comments[0].body).to.equal('more info plz')
			}

			testbed.issueConfig.issue.body = 'version'
			await testbed.postComment('hello', 'not-bot')

			{
				await new NeedsMoreInfoLabeler(
					testbed,
					'needs-more-info',
					'more info plz',
					'version',
					'TAG',
					['bot'],
				).run()
				const updatedIssue = await testbed.getIssue()
				expect(updatedIssue.labels).to.contain('needs-more-info')
			}
		})
	})
})
