import * as yargs from 'yargs'
import { Queryer } from './Queryer'
import { OctoKit } from '../api/octokit'

import * as fs from 'fs'
import { normalizeIssue } from '../utils/utils'

const argv = yargs
	.option('token', {
		alias: 't',
		description: 'GitHub PAT',
		type: 'string',
		demandOption: true,
	})
	.option('limit', {
		alias: 'l',
		description: 'Maximum umber of issues to return',
		type: 'number',
	})
	.option('out', {
		alias: 'u',
		description: 'Output file path',
		type: 'string',
		demandOption: true,
	})
	.option('query', {
		alias: 'q',
		description: 'Thing to query for',
		type: 'string',
		demandOption: true,
	})
	.option('repo', {
		alias: 'r',
		description: 'Repo to query in',
		type: 'string',
		demandOption: true,
	})
	.option('owner', {
		alias: 'o',
		description: 'Owner of repo to query in',
		type: 'string',
		demandOption: true,
	})
	.help()
	.alias('help', 'h').argv

const main = async () => {
	const results = (
		await new Queryer(
			new OctoKit(argv.token, { repo: argv.repo, owner: argv.owner }),
			argv.query,
			argv.limit,
		).run()
	)
		.map((issue) => ({ number: issue.number, labels: issue.labels, ...normalizeIssue(issue) }))
		.map((issue) => JSON.stringify(issue))
	fs.writeFileSync(argv.out, results.join('\n'))
}

main().catch(console.error)
