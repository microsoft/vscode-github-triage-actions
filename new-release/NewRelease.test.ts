/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect } from 'chai'
import * as nock from 'nock'
import { TestbedIssue } from '../api/testbed'
import { NewRelease } from './NewRelease'

const setup = (payload: { productVersion: string; timestamp: number }) =>
	nock('https://update.code.visualstudio.com').get('/api/update/darwin/stable/latest').reply(200, payload)

describe('NewRelease', () => {
	it('adds label when body contains version tag and is recent enough', async () => {
		setup({ productVersion: '1.43.0', timestamp: Date.now() })
		const testbed = new TestbedIssue({}, { issue: { body: 'VS Code Version: 1.43.0' } })
		await new NewRelease(testbed, 'new-release', '121212', 'desc', 3).run()
		expect((await testbed.getIssue()).labels).contains('new-release')
	})

	it('doesnt add label when body contains version tag but isnt recent enough', async () => {
		setup({ productVersion: '1.43.0', timestamp: Date.now() - 1000 * 60 * 60 * 24 * 7 })
		const testbed = new TestbedIssue({}, { issue: { body: 'VS Code Version: 1.43.0' } })
		await new NewRelease(testbed, 'new-release', '121212', 'desc', 3).run()
		expect((await testbed.getIssue()).labels).not.contains('new-release')
	})

	it('doesnt add label when body doesnt contain version tag', async () => {
		setup({ productVersion: '1.43.0', timestamp: Date.now() })
		const testbed = new TestbedIssue({}, { issue: { body: 'VS Code Version: 1.42.0' } })
		await new NewRelease(testbed, 'new-release', '121212', 'desc', 3).run()
		expect((await testbed.getIssue()).labels).not.contains('new-release')
	})

	it('doesnt add label when body contains version tag and insiders', async () => {
		setup({ productVersion: '1.43.0', timestamp: Date.now() })
		const testbed = new TestbedIssue({}, { issue: { body: 'VS Code Version: 1.43.0 - Insiders' } })
		await new NewRelease(testbed, 'new-release', '121212', 'desc', 3).run()
		expect((await testbed.getIssue()).labels).not.contains('new-release')
	})

	it('creates the label if it does not exist', async () => {
		setup({ productVersion: '1.43.0', timestamp: Date.now() })
		const testbed = new TestbedIssue({}, { issue: { body: 'VS Code Version: 1.43.0' } })
		expect(await testbed.repoHasLabel('new-release')).to.be.false
		await new NewRelease(testbed, 'new-release', '121212', 'desc', 3).run()
		expect(await testbed.repoHasLabel('new-release')).to.be.true
	})

	it('deletes the label when the latest release falls out of scope', async () => {
		setup({ productVersion: '1.43.0', timestamp: Date.now() - 1000 * 60 * 60 * 24 * 7 })
		const testbed = new TestbedIssue(
			{ globalLabels: ['new-release'] },
			{ issue: { body: 'VS Code Version: 1.43.0' } },
		)
		expect(await testbed.repoHasLabel('new-release')).to.be.true
		await new NewRelease(testbed, 'new-release', '121212', 'desc', 3).run()
		expect(await testbed.repoHasLabel('new-release')).to.be.false
	})
})
