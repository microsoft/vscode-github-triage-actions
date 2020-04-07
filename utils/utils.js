"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const core = require("@actions/core");
const github_1 = require("@actions/github");
const axios_1 = require("axios");
const octokit_1 = require("../api/octokit");
exports.getInput = (name) => core.getInput(name);
exports.getRequiredInput = (name) => core.getInput(name, { required: true });
exports.loadLatestRelease = async (quality) => (await axios_1.default.get(`https://vscode-update.azurewebsites.net/api/update/darwin/${quality}/latest`)).data;
exports.daysAgoToTimestamp = (days) => +new Date(Date.now() - days * 24 * 60 * 60 * 1000);
exports.daysAgoToHumanReadbleDate = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}\w$/, '');
exports.logRateLimit = async () => {
    const usageData = (await new github_1.GitHub(exports.getRequiredInput('token')).rateLimit.get()).data.resources;
    ['core', 'graphql', 'search'].forEach(async (category) => {
        const usage = 1 - usageData[category].remaining / usageData[category].limit;
        const message = `Usage at ${usage} for ${category}`;
        if (usage > 0) {
            console.log(message);
        }
        if (usage > 0.5) {
            await exports.logErrorToIssue(message, false);
        }
    });
};
exports.logErrorToIssue = async (message, ping) => {
    // Attempt to wait out abuse detection timeout if present
    await new Promise((resolve) => setTimeout(resolve, 10000));
    const dest = github_1.context.repo.repo === 'vscode-internalbacklog'
        ? { repo: 'vscode-internalbacklog', issue: 974 }
        : { repo: 'vscode', issue: 93814 };
    return new octokit_1.OctoKitIssue(exports.getRequiredInput('token'), { owner: 'Microsoft', repo: dest.repo }, { number: dest.issue }).postComment(`
Workflow: ${github_1.context.workflow}

Error: ${message}

Issue: ${ping ? `${github_1.context.repo.owner}/${github_1.context.repo.repo}#` : ''}${github_1.context.issue.number}

Repo: ${github_1.context.repo.owner}/${github_1.context.repo.repo}

<!-- Context:
${JSON.stringify(github_1.context, null, 2).replace(/<!--/g, '<@--').replace(/-->/g, '--@>')}
-->
`);
};
