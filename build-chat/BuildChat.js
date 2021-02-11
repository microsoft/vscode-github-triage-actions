"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const rest_1 = require("@octokit/rest");
const web_api_1 = require("@slack/web-api");
const storage_blob_1 = require("@azure/storage-blob");
let safeLog; // utils.ts needs GITHUB_REPOSITORY set below.
if (require.main === module) {
    process.env.GITHUB_REPOSITORY = 'microsoft/vscode-remote-containers';
    safeLog = require('../common/utils').safeLog;
    const auth = `token ${process.env.GITHUB_TOKEN}`;
    const octokit = new rest_1.Octokit({ auth });
    const workflowUrl = 'https://api.github.com/repos/microsoft/vscode-remote-containers/actions/runs/552662814';
    const options = {
        slackToken: process.env.SLACK_TOKEN,
        storageConnectionString: process.env.STORAGE_CONNECTION_STRING,
        notifyAuthors: true,
        notificationChannel: 'bottest',
        logChannel: 'bot-log',
    };
    (async () => {
        await buildChat(octokit, workflowUrl, options);
    })().then(undefined, safeLog);
}
else {
    safeLog = require('../common/utils').safeLog;
}
async function buildChat(octokit, workflowUrl, options = {}) {
    safeLog(workflowUrl);
    const parts = workflowUrl.split('/');
    const owner = parts[parts.length - 5];
    const repo = parts[parts.length - 4];
    const runId = parseInt(parts[parts.length - 1], 10);
    await handleNotification(octokit, owner, repo, runId, options);
}
exports.buildChat = buildChat;
async function handleNotification(octokit, owner, repo, runId, options) {
    const results = await buildComplete(octokit, owner, repo, runId, options);
    if (options.slackToken && (results.logMessages.length || results.messages.length)) {
        const web = new web_api_1.WebClient(options.slackToken);
        const memberships = await listAllMemberships(web);
        const logChannel = options.logChannel && memberships.find((m) => m.name === options.logChannel);
        if (options.logChannel && !logChannel) {
            safeLog(`Log channel not found: ${options.logChannel}`);
        }
        if (logChannel) {
            for (const logMessage of results.logMessages) {
                await web.chat.postMessage({
                    text: logMessage,
                    link_names: true,
                    channel: logChannel.id,
                    as_user: true,
                });
            }
        }
        const usersByName = {};
        if (options.notifyAuthors) {
            for await (const page of web.paginate('users.list')) {
                for (const member of page.members) {
                    usersByName[member.name] = member;
                }
            }
        }
        const notificationChannel = options.notificationChannel && memberships.find((m) => m.name === options.notificationChannel);
        if (options.notificationChannel && !notificationChannel) {
            safeLog(`Notification channel not found: ${options.notificationChannel}`);
        }
        for (const message of results.messages) {
            const notificationChannels = [];
            if (logChannel) {
                notificationChannels.push(logChannel);
            }
            if (notificationChannel) {
                notificationChannels.push(notificationChannel);
            }
            if (options.notifyAuthors) {
                for (const slackAuthor of message.slackAuthors) {
                    const user = usersByName[slackAuthor];
                    if (user) {
                        const channel = (await web.conversations.open({
                            users: user.id,
                        })).channel;
                        notificationChannels.push(channel);
                    }
                    else {
                        safeLog(`Slack user not found: ${slackAuthor}`);
                    }
                }
            }
            for (const channel of notificationChannels) {
                await web.chat.postMessage({
                    text: message.text,
                    link_names: true,
                    channel: channel.id,
                    as_user: true,
                });
            }
        }
    }
    if (!options.slackToken) {
        for (const message of results.logMessages) {
            safeLog(message);
        }
        for (const message of results.messages) {
            safeLog(message.text);
        }
    }
}
async function buildComplete(octokit, owner, repo, runId, options) {
    safeLog(`buildComplete: https://github.com/${owner}/${repo}/actions/runs/${runId}`);
    const buildResult = (await octokit.actions.getWorkflowRun({
        owner,
        repo,
        run_id: runId,
    })).data;
    const parts = buildResult.workflow_url.split('/');
    const workflowId = parseInt(parts[parts.length - 1], 10);
    const build = (await octokit.actions.getWorkflow({
        owner,
        repo,
        workflow_id: workflowId,
    })).data;
    const buildResults = (await octokit.actions.listWorkflowRuns({
        owner,
        repo,
        workflow_id: workflowId,
        branch: buildResult.head_branch || undefined,
        per_page: 5,
    })).data.workflow_runs.filter((run) => run.status === 'completed');
    buildResults.sort((a, b) => -a.created_at.localeCompare(b.created_at));
    const currentBuildIndex = buildResults.findIndex((build) => build.id === buildResult.id);
    if (currentBuildIndex === -1) {
        safeLog('Build not on first page. Terminating.');
        safeLog(JSON.stringify(buildResults.map(({ id, status, conclusion }) => ({ id, status, conclusion }))));
        throw new Error('Build not on first page. Terminating.');
    }
    const slicedResults = buildResults.slice(currentBuildIndex, currentBuildIndex + 2);
    const builds = slicedResults.map((build, i, array) => ({
        data: build,
        previousSourceVersion: i < array.length - 1 ? array[i + 1].head_sha : undefined,
        authors: [],
        buildHtmlUrl: build.html_url,
        changesHtmlUrl: '',
    }));
    const logMessages = builds
        .slice(0, 1)
        .map((build) => `Id: ${build.data.id} | Repository: ${owner}/${repo} | Branch: ${build.data.head_branch} | Conclusion: ${build.data.conclusion} | Created: ${build.data.created_at} | Updated: ${build.data.updated_at}`);
    const transitionedBuilds = builds.filter((build, i, array) => i < array.length - 1 && transitioned(build, array[i + 1]));
    await Promise.all(transitionedBuilds.map(async (build) => {
        if (build.previousSourceVersion) {
            const cmp = await compareCommits(octokit, owner, repo, build.previousSourceVersion, build.data.head_sha);
            const commits = cmp.data.commits;
            const authors = new Set([
                ...commits.map((c) => c.author.login),
                ...commits.map((c) => c.committer.login),
            ]);
            authors.delete('web-flow'); // GitHub Web UI committer
            build.authors = [...authors];
            build.changesHtmlUrl = `https://github.com/${owner}/${repo}/compare/${build.previousSourceVersion.substr(0, 7)}...${build.data.head_sha.substr(0, 7)}`; // Shorter than: cmp.data.html_url
        }
    }));
    const vscode = repo === 'vscode';
    const name = vscode ? `VS Code ${build.name} Build` : build.name;
    // TBD: `Requester: ${vstsToSlackUser(build.requester, build.degraded)}${pingBenForSmokeTests && releaseBuild && build.result === 'partiallySucceeded' ? ' | Ping: @bpasero' : ''}`
    const accounts = await readAccounts(options.storageConnectionString);
    const githubAccountMap = githubToAccounts(accounts);
    const messages = transitionedBuilds.map((build) => {
        return {
            text: `${name}
Result: ${build.data.conclusion} | Repository: ${owner}/${repo} | Branch: ${build.data.head_branch} | Authors: ${githubToSlackUsers(githubAccountMap, build.authors, build.degraded).sort().join(', ') ||
                `None (rebuild)`}
Build: ${build.buildHtmlUrl}
Changes: ${build.changesHtmlUrl}`,
            slackAuthors: build.authors.map((a) => { var _a; return (_a = githubAccountMap[a]) === null || _a === void 0 ? void 0 : _a.slack; }).filter((a) => !!a),
        };
    });
    return { logMessages, messages };
}
const conclusions = ['success', 'failure'];
function transitioned(newer, older) {
    const newerResult = newer.data.conclusion || 'success';
    const olderResult = older.data.conclusion || 'success';
    if (newerResult === olderResult) {
        return false;
    }
    if (conclusions.indexOf(newerResult) > conclusions.indexOf(olderResult)) {
        newer.degraded = true;
    }
    return true;
}
async function compareCommits(octokit, owner, repo, base, head) {
    return octokit.repos.compareCommits({ owner, repo, base, head });
}
function githubToSlackUsers(githubToAccounts, githubUsers, at) {
    return githubUsers.map((g) => (githubToAccounts[g] ? `${at ? '@' : ''}${githubToAccounts[g].slack}` : g));
}
function githubToAccounts(accounts) {
    return accounts.reduce((m, e) => {
        m[e.github] = e;
        return m;
    }, {});
}
async function readAccounts(connectionString) {
    if (!connectionString) {
        safeLog('Connection string missing.');
        return [];
    }
    const blobServiceClient = storage_blob_1.BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient('config');
    const createContainerResponse = containerClient.getBlockBlobClient('accounts.json');
    const buf = await createContainerResponse.downloadToBuffer();
    return JSON.parse(buf.toString());
}
async function listAllMemberships(web) {
    const groups = (await web.conversations.list({
        types: 'public_channel,private_channel',
    }));
    return groups.channels.filter((c) => c.is_member);
}
//# sourceMappingURL=BuildChat.js.map