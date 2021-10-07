/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect } from 'chai'
import { Issue } from '../api/api'
import { TestbedIssue } from '../api/testbed'
import { Command, Commands } from './Commands'

const dummyHydrate = (comment: string, _issue: Issue) => comment.replace('${DUMMY}', 'hello :)')

describe('Commands', () => {
	describe('Comments', () => {
		it('Close (team member)', async () => {
			const testbed = new TestbedIssue({ writers: ['JacksonKearl'] })
			const commands: Command[] = [{ type: 'comment', action: 'close', allowUsers: [], name: 'hello' }]

			expect((await testbed.getIssue()).open).to.equal(true)
			await new Commands(
				testbed,
				commands,
				{
					comment: '/hello',
					user: { name: 'NotJacksonKearl' },
				},
				dummyHydrate,
			).run()
			expect((await testbed.getIssue()).open).to.equal(true)
			await new Commands(
				testbed,
				commands,
				{
					comment: '/hello',
					user: { name: 'JacksonKearl' },
				},
				dummyHydrate,
			).run()
			expect((await testbed.getIssue()).open).to.equal(false)
		})

		it('Close (allowed third party)', async () => {
			const testbed = new TestbedIssue()
			const commands: Command[] = [
				{ type: 'comment', action: 'close', allowUsers: ['JacksonKearl'], name: 'hello' },
			]

			expect((await testbed.getIssue()).open).to.equal(true)
			await new Commands(
				testbed,
				commands,
				{
					comment: '/hello',
					user: { name: 'NotJacksonKearl' },
				},
				dummyHydrate,
			).run()
			expect((await testbed.getIssue()).open).to.equal(true)
			await new Commands(
				testbed,
				commands,
				{
					comment: '/hello',
					user: { name: 'JacksonKearl' },
				},
				dummyHydrate,
			).run()
			expect((await testbed.getIssue()).open).to.equal(false)
		})

		it('Close (allowed all third parties)', async () => {
			const testbed = new TestbedIssue()
			const commands: Command[] = [
				{ type: 'comment', action: 'close', allowUsers: ['*'], name: 'hello' },
			]

			expect((await testbed.getIssue()).open).to.equal(true)
			await new Commands(
				testbed,
				commands,
				{
					comment: '/hello',
					user: { name: 'Rando' },
				},
				dummyHydrate,
			).run()
			expect((await testbed.getIssue()).open).to.equal(false)
		})

		it('Close (allowed author)', async () => {
			const testbed = new TestbedIssue()
			const commands: Command[] = [
				{ type: 'comment', action: 'close', allowUsers: ['@author'], name: 'hello' },
			]

			expect((await testbed.getIssue()).open).to.equal(true)
			await new Commands(
				testbed,
				commands,
				{
					comment: '/hello',
					user: { name: 'NotJacksonKearl' },
				},
				dummyHydrate,
			).run()
			expect((await testbed.getIssue()).open).to.equal(true)
			await new Commands(
				testbed,
				commands,
				{
					comment: '/hello',
					user: { name: 'JacksonKearl' },
				},
				dummyHydrate,
			).run()
			expect((await testbed.getIssue()).open).to.equal(false)
		})

		it('Close (disallowedLabel)', async () => {
			const testbed = new TestbedIssue({}, { labels: ['nope'] })
			const commands: Command[] = [
				{
					type: 'comment',
					action: 'close',
					allowUsers: ['@author'],
					name: 'hello',
					disallowLabel: 'nope',
				},
			]

			expect((await testbed.getIssue()).open).to.equal(true)
			await new Commands(
				testbed,
				commands,
				{
					comment: '/hello',
					user: { name: 'JacksonKearl' },
				},
				dummyHydrate,
			).run()
			expect((await testbed.getIssue()).open).to.equal(true)
		})

		it('Close (allowedLabel)', async () => {
			const testbed = new TestbedIssue({}, { labels: ['nope'] })
			const commands: Command[] = [
				{
					type: 'comment',
					action: 'close',
					allowUsers: ['@author'],
					name: 'hello',
					requireLabel: 'pope',
				},
			]

			expect((await testbed.getIssue()).open).to.equal(true)
			await new Commands(
				testbed,
				commands,
				{
					comment: '/hello',
					user: { name: 'JacksonKearl' },
				},
				dummyHydrate,
			).run()
			expect((await testbed.getIssue()).open).to.equal(true)
		})

		it('Update Labels', async () => {
			const testbed = new TestbedIssue({ writers: ['JacksonKearl'] }, { labels: ['old', 'veryOld'] })
			const commands: Command[] = [
				{
					type: 'comment',
					allowUsers: [],
					name: 'hello',
					addLabel: 'new',
					removeLabel: 'old',
				},
			]

			expect((await testbed.getIssue()).labels).to.contain('old')
			expect((await testbed.getIssue()).labels).not.to.contain('new')

			await new Commands(
				testbed,
				commands,
				{
					comment: '/hello',
					user: { name: 'NotJacksonKearl' },
				},
				dummyHydrate,
			).run()
			expect((await testbed.getIssue()).labels).to.contain('old')
			expect((await testbed.getIssue()).labels).not.to.contain('new')

			await new Commands(
				testbed,
				commands,
				{
					comment: '/hello',
					user: { name: 'JacksonKearl' },
				},
				dummyHydrate,
			).run()
			expect((await testbed.getIssue()).labels).not.to.contain('old')
			expect((await testbed.getIssue()).labels).to.contain('new')
		})

		it('Prefix matches', async () => {
			const testbed = new TestbedIssue({ writers: ['JacksonKearl'] })
			const commands: Command[] = [{ type: 'comment', action: 'close', allowUsers: [], name: 'hello' }]

			expect((await testbed.getIssue()).open).to.equal(true)
			await new Commands(
				testbed,
				commands,
				{
					comment: '/helloworld',
					user: { name: 'JacksonKearl' },
				},
				dummyHydrate,
			).run()
			expect((await testbed.getIssue()).open).to.equal(true)
			await new Commands(
				testbed,
				commands,
				{
					comment: '\\hello',
					user: { name: 'JacksonKearl' },
				},
				dummyHydrate,
			).run()
			expect((await testbed.getIssue()).open).to.equal(false)
		})

		it('Regex Escapes', async () => {
			const testbed = new TestbedIssue({ writers: ['JacksonKearl'] })
			const commands: Command[] = [
				{ type: 'comment', action: 'close', allowUsers: [], name: 'c++iscool' },
			]

			expect((await testbed.getIssue()).open).to.equal(true)
			await new Commands(
				testbed,
				commands,
				{
					comment: '/c++iscool',
					user: { name: 'JacksonKearl' },
				},
				dummyHydrate,
			).run()
			expect((await testbed.getIssue()).open).to.equal(false)
		})

		it('adds labels to issues with /label comment', async () => {
			const testbed = new TestbedIssue({ writers: ['JacksonKearl'] })
			const commands: Command[] = [{ type: 'comment', allowUsers: [], name: 'label' }]
			await new Commands(
				testbed,
				commands,
				{
					comment: '/label hello "hello world"',
					user: { name: 'JacksonKearl' },
				},
				dummyHydrate,
			).run()
			expect((await testbed.getIssue()).labels).to.include('hello')
			expect((await testbed.getIssue()).labels).to.include('hello world')
		})

		it('adds assignees to issues with /assign comment', async () => {
			const testbed = new TestbedIssue({ writers: ['JacksonKearl'] })
			const commands: Command[] = [{ type: 'comment', allowUsers: [], name: 'assign' }]
			await new Commands(
				testbed,
				commands,
				{
					comment: '/assign Jackso \r\n',
					user: { name: 'JacksonKearl' },
				},
				dummyHydrate,
			).run()
			expect((await testbed.getIssue()).assignee).to.equal('Jackso')
		})

		it('removes labels with - prefix in /label comment', async () => {
			const testbed = new TestbedIssue(
				{ writers: ['JacksonKearl'] },
				{ labels: ['hello', 'hello world'] },
			)
			const commands: Command[] = [{ type: 'comment', allowUsers: [], name: 'label' }]
			await new Commands(
				testbed,
				commands,
				{
					comment: '/label -hello -"hello world" "-hello"',
					user: { name: 'JacksonKearl' },
				},
				dummyHydrate,
			).run()
			expect((await testbed.getIssue()).labels).not.to.include('hello')
			expect((await testbed.getIssue()).labels).not.to.include('hello world')
			expect((await testbed.getIssue()).labels).to.include('-hello')
		})

		it('removes assignees with - prefix in /assign comment', async () => {
			const testbed = new TestbedIssue(
				{ writers: ['JacksonKearl'] },
				{ issue: { assignee: 'JacksonKearl' } },
			)
			const commands: Command[] = [{ type: 'comment', allowUsers: [], name: 'assign' }]
			await new Commands(
				testbed,
				commands,
				{
					comment: '/assign -JacksonKearl \r\n',
					user: { name: 'JacksonKearl' },
				},
				dummyHydrate,
			).run()
			expect((await testbed.getIssue()).assignee).to.equal(undefined)
		})
	})

	describe('Labels', () => {
		it('close', async () => {
			const testbed = new TestbedIssue({ writers: ['JacksonKearl'] })
			const commands: Command[] = [{ type: 'label', action: 'close', name: 'hello' }]

			await new Commands(
				testbed,
				commands,
				{
					label: 'hello',
					user: { name: 'JacksonKearl' },
				},
				dummyHydrate,
			).run()
			expect((await testbed.getIssue()).open).to.equal(false)
		})

		it('Comments', async () => {
			const testbed = new TestbedIssue({ writers: ['JacksonKearl'] })
			const commands: Command[] = [
				{
					type: 'label',
					action: 'close',
					comment: 'myComment ${DUMMY}',
					name: 'hello',
				},
			]

			await new Commands(
				testbed,
				commands,
				{
					label: 'hello',
					user: { name: 'JacksonKearl' },
				},
				dummyHydrate,
			).run()
			expect((await testbed.getIssue()).open).to.equal(false)
			const comments = []
			for await (const page of testbed.getComments()) {
				comments.push(...page)
			}
			expect(comments[0].body).to.equal('myComment hello :)')
		})

		it('Comments (regex)', async () => {
			const testbed = new TestbedIssue({ writers: ['JacksonKearl'] })
			const commands: Command[] = [
				{
					type: 'label',
					regex: 'hello-.+',
					action: 'close',
					comment: 'myComment ${DUMMY}',
					name: 'hello',
				},
			]

			await new Commands(
				testbed,
				commands,
				{
					label: 'hello-world',
					user: { name: 'JacksonKearl' },
				},
				dummyHydrate,
			).run()

			expect((await testbed.getIssue()).open).to.equal(false)
			const comments = []
			for await (const page of testbed.getComments()) {
				comments.push(...page)
			}
			expect(comments[0].body).to.equal('myComment hello :)')
		})

		it('But doesnt comment when the issue was closed', async () => {
			const testbed = new TestbedIssue({ writers: ['JacksonKearl'] }, { issue: { open: false } })
			const commands: Command[] = [
				{
					type: 'label',
					action: 'close',
					comment: 'myComment',
					name: 'hello',
				},
			]

			await new Commands(
				testbed,
				commands,
				{
					label: 'hello',
					user: { name: 'JacksonKearl' },
				},
				dummyHydrate,
			).run()
			expect((await testbed.getIssue()).open).to.equal(false)
			const comments = []
			for await (const page of testbed.getComments()) {
				comments.push(...page)
			}
			expect(comments[0]).to.be.undefined
		})
	})
})
