"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const yargs = require("yargs");
const EnglishPlease_1 = require("./EnglishPlease");
const octokit_1 = require("../api/octokit");
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
const main = async () => {
    // Check if it's a promise
    const args = await argv;
    const [, owner, repo] = /(.*)\/(.*)/.exec(args.repo);
    await new EnglishPlease_1.LanguageSpecificLabeler(new octokit_1.OctoKitIssue(args.token, { repo, owner }, { number: args.number }, { readonly: !args.write }), 'translation-required-', 'c29cff', '*english-please', 'info-needed', args.key).run();
};
main().catch(console.error);
//# sourceMappingURL=cli.js.map