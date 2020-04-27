"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const yargs = require("yargs");
const Queryer_1 = require("./Queryer");
const octokit_1 = require("../api/octokit");
const utils_1 = require("../utils/utils");
const argv = yargs
    .option('token', {
    alias: 't',
    description: 'GitHub PAT',
    type: 'string',
    demandOption: true,
})
    .option('limit', {
    alias: 'l',
    description: 'Maximum number of issues to return',
    type: 'number',
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
    .alias('help', 'h').argv;
const main = async () => {
    const results = (await new Queryer_1.Queryer(new octokit_1.OctoKit(argv.token, { repo: argv.repo, owner: argv.owner }), argv.query, argv.limit).run())
        .map((issue) => ({ number: issue.number, labels: issue.labels, ...utils_1.normalizeIssue(issue) }))
        .map((issue) => JSON.stringify(issue));
};
main().catch(console.error);
//# sourceMappingURL=cli.js.map