/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect } from 'chai'
import { Query } from '../api/api'
import { TestbedIssue, TestbedIssueConstructorArgs } from '../api/testbed'
import { AddExtraLabel } from './addExtraLabel'

describe('AddExtraLabel', () => {
	it('Adds a label ', async () => {
		const issue: TestbedIssueConstructorArgs = {
			issue: {
				open: false,
				locked: false,
			},
			labels: ['foobar'],
		}

		const queryRunner = async function* (
			query: Query,
		): AsyncIterableIterator<TestbedIssueConstructorArgs[]> {
			expect(query.q).to.contain('closed')
			yield [issue]
		}

		const testbed = new TestbedIssue({ queryRunner }, issue)
		let testbedIssue = await testbed.getIssue()
		expect(testbedIssue?.labels).to.contain('foobar')
		await new AddExtraLabel(testbed, 'baz').run()
		testbedIssue = await testbed.getIssue()
		expect(testbedIssue?.labels).to.contain('baz')
		expect(testbedIssue?.labels).to.contain('foobar')
	})
})
