/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect } from 'chai'
import { Query } from '../api/api'
import { Testbed, TestbedIssueConstructorArgs } from '../api/testbed'
import { Locker } from './Locker'

describe('Locker', () => {
	it('creates a reasonable query and locks the issues the query yields', async () => {
		const issue: TestbedIssueConstructorArgs = {
			issue: {
				open: false,
				locked: false,
			},
		}

		const queryRunner = async function* (
			query: Query,
		): AsyncIterableIterator<TestbedIssueConstructorArgs[]> {
			expect(query.q).to.contain('closed')
			yield [issue]
		}

		const testbed = new Testbed({ queryRunner })
		expect(issue?.issue?.locked).to.be.false
		await new Locker(testbed, 10, 1).run()
		expect(issue?.issue?.locked).to.be.true
	})

	it('observes the exclude label if present', async () => {
		const queryRunner = async function* (
			query: Query,
		): AsyncIterableIterator<TestbedIssueConstructorArgs[]> {
			expect(query.q).to.contain('-label:exclude')
			yield []
		}

		const testbed = new Testbed({ queryRunner })
		await new Locker(testbed, 10, 1, 'exclude').run()
	})
})
