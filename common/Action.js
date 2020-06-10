"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const octokit_1 = require("../api/octokit");
const github_1 = require("@actions/github");
const utils_1 = require("./utils");
const core_1 = require("@actions/core");
const appInsights = require("applicationinsights");
let aiHandle = undefined;
const aiKey = core_1.getInput('appInsightsKey');
if (aiKey) {
    appInsights
        .setup(aiKey)
        .setAutoDependencyCorrelation(false)
        .setAutoCollectRequests(false)
        .setAutoCollectPerformance(false, false)
        .setAutoCollectExceptions(false)
        .setAutoCollectDependencies(false)
        .setAutoCollectConsole(false)
        .setUseDiskRetryCaching(false)
        .start();
    aiHandle = appInsights.defaultClient;
}
class Action {
    constructor() {
        this.token = utils_1.getRequiredInput('token');
        this.username = new github_1.GitHub(this.token).users.getAuthenticated().then((v) => v.data.name);
    }
    async trackMetric(telemetry) {
        console.log('tracking metric:', telemetry);
        if (aiHandle) {
            aiHandle.trackMetric({
                ...telemetry,
                properties: {
                    repo: `${github_1.context.repo.owner}/${github_1.context.repo.repo}`,
                    id: this.id,
                    user: await this.username,
                },
            });
        }
    }
    async run() {
        var _a;
        try {
            const token = utils_1.getRequiredInput('token');
            const readonly = !!core_1.getInput('readonly');
            const issue = (_a = github_1.context === null || github_1.context === void 0 ? void 0 : github_1.context.issue) === null || _a === void 0 ? void 0 : _a.number;
            if (issue) {
                const octokit = new octokit_1.OctoKitIssue(token, github_1.context.repo, { number: issue }, { readonly });
                if (github_1.context.eventName === 'issue_comment') {
                    await this.onCommented(octokit, github_1.context.payload.comment.body, github_1.context.actor);
                }
                else if (github_1.context.eventName === 'issue') {
                    switch (github_1.context.payload.action) {
                        case 'opened':
                            await this.onOpened(octokit);
                            break;
                        case 'reopened':
                            await this.onReopened(octokit);
                            break;
                        case 'closed':
                            await this.onClosed(octokit);
                            break;
                        case 'labeled':
                            await this.onLabeled(octokit, github_1.context.payload.label.name);
                            break;
                        case 'edited':
                            await this.onEdited(octokit);
                            break;
                        case 'milestoned':
                            await this.onMilestoned(octokit);
                            break;
                        default:
                            throw Error('Unexpected action: ' + github_1.context.payload.action);
                    }
                }
            }
            else {
                await this.onTriggered(new octokit_1.OctoKit(token, github_1.context.repo, { readonly }));
            }
        }
        catch (e) {
            await this.error(e);
        }
        await this.trackMetric({ name: 'octokit_request_count', value: octokit_1.getNumRequests() });
        const usage = await utils_1.getRateLimit(this.token);
        await this.trackMetric({ name: 'usage_core', value: usage.core });
        await this.trackMetric({ name: 'usage_graphql', value: usage.graphql });
        await this.trackMetric({ name: 'usage_search', value: usage.search });
    }
    async error(message) {
        const details = {
            message,
            repo: `${github_1.context.repo.owner}/${github_1.context.repo.repo}`,
            id: this.id,
            user: await this.username,
        };
        if (github_1.context.issue.number)
            details.issue = github_1.context.issue.number;
        const token = core_1.getInput('token');
        const rendered = JSON.stringify(details, null, 2);
        if (token) {
            await utils_1.logErrorToIssue(rendered, false, token);
        }
        core_1.setFailed(message);
    }
    async onTriggered(_octokit) {
        throw Error('not implemented');
    }
    async onEdited(_issue) {
        throw Error('not implemented');
    }
    async onLabeled(_issue, _label) {
        throw Error('not implemented');
    }
    async onOpened(_issue) {
        throw Error('not implemented');
    }
    async onReopened(_issue) {
        throw Error('not implemented');
    }
    async onClosed(_issue) {
        throw Error('not implemented');
    }
    async onMilestoned(_issue) {
        throw Error('not implemented');
    }
    async onCommented(_issue, _comment, _actor) {
        throw Error('not implemented');
    }
}
exports.Action = Action;
//# sourceMappingURL=Action.js.map