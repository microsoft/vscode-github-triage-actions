"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthenticationToken = exports.Action = void 0;
const core_1 = require("@actions/core");
const github_1 = require("@actions/github");
const auth_app_1 = require("@octokit/auth-app");
const uuid_1 = require("uuid");
const octokit_1 = require("../api/octokit");
const utils_1 = require("../common/utils");
const utils_2 = require("./utils");
class Action {
    constructor() {
        console.log('::stop-commands::' + (0, uuid_1.v4)());
        this.repoName = this.getRepoName();
        this.repoOwner = this.getRepoOwner();
        this.issue = this.getIssueNumber();
    }
    async getToken() {
        var _a;
        // Temporary workaround until all workflows have been updated to authenticating with a GitHub App
        const token = (_a = (0, utils_1.getInput)('token')) !== null && _a !== void 0 ? _a : (await getAuthenticationToken());
        return token;
    }
    getRepoName() {
        var _a;
        return (_a = (0, utils_1.getInput)('repo')) !== null && _a !== void 0 ? _a : github_1.context.repo.repo;
    }
    getRepoOwner() {
        var _a;
        return (_a = (0, utils_1.getInput)('owner')) !== null && _a !== void 0 ? _a : github_1.context.repo.owner;
    }
    getIssueNumber() {
        var _a, _b, _c, _d, _e;
        const issueNumber = +((_a = (0, utils_1.getInput)('issue_number')) !== null && _a !== void 0 ? _a : 0);
        return ((_d = (_b = (issueNumber > 0 ? issueNumber : undefined)) !== null && _b !== void 0 ? _b : (_c = github_1.context.issue) === null || _c === void 0 ? void 0 : _c.number) !== null && _d !== void 0 ? _d : (_e = github_1.context.payload.issue) === null || _e === void 0 ? void 0 : _e.number);
    }
    getAssignee() {
        const payload = (0, utils_1.getInput)('payload');
        let assignee = '';
        if (payload) {
            assignee = JSON.parse(payload).assignee;
        }
        else {
            assignee = github_1.context.payload.assignee.login;
        }
        return assignee;
    }
    getComment() {
        var _a, _b;
        const payload = (0, utils_1.getInput)('comment');
        let comment = '';
        if (payload) {
            comment = (_a = JSON.parse(payload)) === null || _a === void 0 ? void 0 : _a.body;
        }
        else {
            comment = (_b = github_1.context.payload.comment) === null || _b === void 0 ? void 0 : _b.body;
        }
        return comment;
    }
    getCommentAuthor() {
        var _a, _b, _c;
        const payload = (0, utils_1.getInput)('comment');
        let author = '';
        if (payload) {
            author = (_a = JSON.parse(payload).user) === null || _a === void 0 ? void 0 : _a.login;
        }
        else {
            author = (_c = (_b = github_1.context.payload.comment) === null || _b === void 0 ? void 0 : _b.user) === null || _c === void 0 ? void 0 : _c.login;
        }
        return author;
    }
    getLabel() {
        var _a;
        const payload = (0, utils_1.getInput)('payload');
        let label = '';
        if (payload) {
            label = JSON.parse(payload).label;
        }
        else {
            label = (_a = github_1.context.payload.label) === null || _a === void 0 ? void 0 : _a.name;
        }
        return label;
    }
    async run() {
        var _a, _b, _c, _d, _e;
        if (utils_2.errorLoggingIssue) {
            const errorIssue = (0, utils_2.errorLoggingIssue)(this.repoName, this.repoOwner);
            if (this.repoName === (errorIssue === null || errorIssue === void 0 ? void 0 : errorIssue.repo) &&
                this.repoOwner === errorIssue.owner &&
                this.issue === errorIssue.issue) {
                return (0, utils_2.safeLog)('refusing to run on error logging issue to prevent cascading errors');
            }
        }
        try {
            const token = await this.getToken();
            const readonly = !!(0, utils_1.getInput)('readonly');
            const event = (_a = (0, utils_1.getInput)('event')) !== null && _a !== void 0 ? _a : github_1.context.eventName;
            if (this.issue) {
                const octokit = new octokit_1.OctoKitIssue(token, { repo: this.repoName, owner: this.repoOwner }, { number: this.issue }, { readonly });
                if (event === 'issue_comment') {
                    await this.onCommented(octokit, this.getComment(), this.getCommentAuthor());
                }
                else if (event === 'issues' ||
                    event === 'pull_request' ||
                    event === 'pull_request_target') {
                    const action = (_b = (0, utils_1.getInput)('action')) !== null && _b !== void 0 ? _b : github_1.context.payload.action;
                    switch (action) {
                        case 'opened':
                        case 'ready_for_review':
                            await this.onOpened(octokit, github_1.context.payload);
                            break;
                        case 'reopened':
                            await this.onReopened(octokit);
                            break;
                        case 'closed':
                            await this.onClosed(octokit, github_1.context.payload);
                            break;
                        case 'labeled':
                            await this.onLabeled(octokit, this.getLabel());
                            break;
                        case 'assigned':
                            await this.onAssigned(octokit, this.getAssignee());
                            break;
                        case 'unassigned':
                            await this.onUnassigned(octokit, this.getAssignee());
                            break;
                        case 'edited':
                            await this.onEdited(octokit);
                            break;
                        case 'milestoned':
                            await this.onMilestoned(octokit);
                            break;
                        case 'converted_to_draft':
                            await this.onConvertedToDraft(octokit, github_1.context.payload);
                            break;
                        default:
                            throw Error('Unexpected action: ' + action);
                    }
                }
            }
            else if (event === 'create') {
                await this.onCreated(new octokit_1.OctoKit(token, { repo: this.repoName, owner: this.repoOwner }, { readonly }), (_c = github_1.context === null || github_1.context === void 0 ? void 0 : github_1.context.payload) === null || _c === void 0 ? void 0 : _c.ref, (_e = (_d = github_1.context === null || github_1.context === void 0 ? void 0 : github_1.context.payload) === null || _d === void 0 ? void 0 : _d.sender) === null || _e === void 0 ? void 0 : _e.login);
            }
            else {
                await this.onTriggered(new octokit_1.OctoKit(token, { repo: this.repoName, owner: this.repoOwner }, { readonly }));
            }
        }
        catch (e) {
            const err = e;
            (0, utils_2.safeLog)((err === null || err === void 0 ? void 0 : err.stack) || (err === null || err === void 0 ? void 0 : err.message) || String(e));
            try {
                await this.error(err);
            }
            catch {
                // Always fail the action even if we don't properly log it to the issue
                (0, core_1.setFailed)(err.message);
            }
        }
    }
    async error(error) {
        const token = await this.getToken();
        const username = (0, github_1.getOctokit)(token)
            .rest.users.getAuthenticated()
            .then((v) => { var _a; return (_a = v.data.name) !== null && _a !== void 0 ? _a : 'unknown'; }, () => 'unknown');
        const details = {
            message: `${error.message}\n${error.stack}`,
            id: this.id,
            user: await username,
        };
        if (this.issue) {
            details.issue = this.issue;
        }
        const rendered = `
Message: ${details.message}

Actor: ${details.user}

ID: ${details.id}
`;
        await (0, utils_2.logErrorToIssue)(rendered, true, token, this.repoName, this.repoOwner);
        (0, core_1.setFailed)(error.message);
    }
    async onTriggered(_octokit) {
        throw Error('not implemented');
    }
    async onCreated(_octokit, _ref, _creator) {
        throw Error('not implemented');
    }
    async onEdited(_issue) {
        throw Error('not implemented');
    }
    async onLabeled(_issue, _label) {
        throw Error('not implemented');
    }
    async onAssigned(_issue, _assignee) {
        throw Error('not implemented');
    }
    async onUnassigned(_issue, _assignee) {
        throw Error('not implemented');
    }
    async onOpened(_issue, _payload) {
        throw Error('not implemented');
    }
    async onReopened(_issue) {
        throw Error('not implemented');
    }
    async onClosed(_issue, _payload) {
        throw Error('not implemented');
    }
    async onConvertedToDraft(_issue, _payload) {
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
async function getAuthenticationToken() {
    const appId = (0, utils_1.getInput)('app_id');
    const installationId = (0, utils_1.getInput)('app_installation_id');
    const privateKey = (0, utils_1.getInput)('app_private_key');
    if (appId && installationId && privateKey) {
        const maxAttempts = 3;
        let attempts = 0;
        while (attempts < maxAttempts) {
            try {
                const appAuth = (0, auth_app_1.createAppAuth)({ appId, installationId, privateKey });
                return (await appAuth({ type: 'installation' })).token;
            }
            catch (error) {
                if (error.response && error.response.status === 504) {
                    attempts++;
                    const delay = Math.pow(2, attempts) * 1000; // Exponential backoff
                    (0, utils_2.safeLog)(`Attempt ${attempts} failed with 504 error. Retrying in ${delay / 1000} seconds.`);
                    if (attempts >= maxAttempts) {
                        throw new Error('Max retry attempts reached. Please try again later');
                    }
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
                else {
                    throw error;
                }
            }
        }
    }
    throw Error('Failed to get authentication token');
}
exports.getAuthenticationToken = getAuthenticationToken;
//# sourceMappingURL=Action.js.map