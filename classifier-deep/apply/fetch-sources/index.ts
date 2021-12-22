/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { writeFileSync } from 'fs'
import { join } from 'path'
import { OctoKit } from '../../../api/octokit'
import { getRequiredInput, daysAgoToHumanReadbleDate, normalizeIssue, safeLog } from '../../../common/utils'
import { Action } from '../../../common/Action'
import { execSync } from 'child_process'
import { getInput, setFailed } from '@actions/core'
import { downloadBlobFile } from '../../blobStorage'

const minToDay = 0.0007
const fromInput = getInput('from') || undefined

const from = fromInput ? daysAgoToHumanReadbleDate(+fromInput * minToDay) : undefined
const until = daysAgoToHumanReadbleDate(+getRequiredInput('until') * minToDay)

const createdQuery = `created:` + (from ? `${from}..${until}` : `<${until}`)

const blobContainer = getRequiredInput('blobContainerName')
const blobStorageKey = getRequiredInput('blobStorageKey')

class FetchIssues extends Action {
	id = 'Clasifier-Deep/Apply/FetchIssues'

	async onTriggered(github: OctoKit) {
		const query = `${createdQuery} is:open no:assignee`

		const data: { number: number; contents: string }[] = []
		for await (const page of github.query({ q: query })) {
			for (const issue of page) {
				const issueData = await issue.getIssue()
				const cleansed = normalizeIssue(issueData)
				data.push({ number: issueData.number, contents: `${cleansed.title}\n\n${cleansed.body}` })
			}
		}

		writeFileSync(join(__dirname, '../issue_data.json'), JSON.stringify(data))

		const config = await github.readConfig(getRequiredInput('configPath'))
		writeFileSync(join(__dirname, '../configuration.json'), JSON.stringify(config))

		safeLog('dowloading area model')
		await downloadBlobFile('area_model.zip', blobContainer, blobStorageKey)
		safeLog('dowloading assignee model')
		await downloadBlobFile('assignee_model.zip', blobContainer, blobStorageKey)

		const classifierDeepRoot = join(__dirname, '..', '..')
		const blobStorage = join(classifierDeepRoot, 'blobStorage')
		const models = join(classifierDeepRoot, 'apply')

		safeLog('unzipping area model')
		execSync(`unzip -q ${join(blobStorage, 'area_model.zip')} -d ${join(models, 'area_model')}`)
		safeLog('unzipping assignee model')
		execSync(`unzip -q ${join(blobStorage, 'assignee_model.zip')} -d ${join(models, 'assignee_model')}`)
	}
}

new FetchIssues().run().catch((e) => setFailed(e.message))
