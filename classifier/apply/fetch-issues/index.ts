/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as core from '@actions/core'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { context } from '@actions/github'
import { OctoKit } from '../../../api/octokit'
import {
	getRequiredInput,
	logErrorToIssue,
	logRateLimit,
	daysAgoToHumanReadbleDate,
	normalizeIssue,
} from '../../../utils/utils'
import { downloadBlobFile } from '../../blobStorage'

const minToDay = 0.0007
const token = getRequiredInput('token')
const from = daysAgoToHumanReadbleDate(+getRequiredInput('from') * minToDay)
const until = daysAgoToHumanReadbleDate(+getRequiredInput('until') * minToDay)

const blobContainer = getRequiredInput('blobContainerName')
const blobStorageKey = getRequiredInput('blobStorageKey')

const main = async () => {
	const github = new OctoKit(token, context.repo)
	const query = `created:>${from} updated:<${until} is:open`

	const data: { number: number; contents: string }[] = []
	for await (const page of github.query({ q: query })) {
		for (const issue of page) {
			const issueData = await issue.getIssue()
			const cleansed = normalizeIssue(issueData)
			data.push({ number: issueData.number, contents: `${cleansed.title}\n\n${cleansed.body}` })
		}
	}
	console.log('Got issues', JSON.stringify(data, null, 2))
	writeFileSync(join(__dirname, '../issue_data.json'), JSON.stringify(data))

	await downloadBlobFile('area-model.pickle', blobContainer, blobStorageKey)
	await downloadBlobFile('area-model-config.json', blobContainer, blobStorageKey)

	await downloadBlobFile('assignee-model.pickle', blobContainer, blobStorageKey)
	await downloadBlobFile('assignee-model-config.json', blobContainer, blobStorageKey)
}

main()
	.then(() => logRateLimit(token))
	.catch(async (error) => {
		core.setFailed(error.message)
		await logErrorToIssue(error, true, token)
	})
