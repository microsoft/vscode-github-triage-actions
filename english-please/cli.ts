import * as yargs from 'yargs';
import { LanguageSpecificLabeler } from './EnglishPlease';
import { OctoKitIssue } from '../api/octokit';

const argv = yargs
	.option('token', {
		alias: 't',
		description: 'GitHub PAT',
		type: 'string',
		demandOption: true,
	})
	.option('key', {
		alias: 'k',
		description: 'Cognative Services Key',
		type: 'string',
		demandOption: true,
	})
	.option('number', {
		alias: 'n',
		description: 'Issue number to act upon',
		type: 'number',
		demandOption: true,
	})
	.option('repo', {
		alias: 'r',
		description: 'Repo to query in',
		type: 'string',
		demandOption: true,
	})
	.option('write', {
		alias: 'w',
		description: 'Enable write-access to repo',
		type: 'boolean',
		default: false,
	})
	.help()
	.alias('help', 'h').argv;

const [, owner, repo] = /(.*)\/(.*)/.exec(argv.repo)!;

const main = async () => {
	await new LanguageSpecificLabeler(
		new OctoKitIssue(argv.token, { repo, owner }, { number: argv.number }, { readonly: !argv.write }),
		'translation-required-',
		'c29cff',
		'*english-please',
		'needs more info',
		argv.key,
	).run();
};

main().catch(console.error);
