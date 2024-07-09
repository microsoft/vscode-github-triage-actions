"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.Action = void 0;
const core_1 = require("@actions/core");
const github_1 = require("@actions/github");
const auth_app_1 = require("@octokit/auth-app");
const uuid_1 = require("uuid");
const octokit_1 = require("../api/octokit");
const utils_1 = require("./utils");
class Action {
    async getToken() {
        // Temporary workaround until all workflows have been updated to authenticating with a GitHub App
        let token = (0, core_1.getInput)('token');
        if (!token) {
            const appId = (0, core_1.getInput)('app_id');
            const installationId = (0, core_1.getInput)('app_installation_id');
            const privateKey = (0, core_1.getInput)('app_private_key');
            if (appId && installationId && privateKey) {
                const appAuth = (0, auth_app_1.createAppAuth)({ appId, installationId, privateKey });
                token = (await appAuth({ type: 'installation' })).token;
            }
            else {
                throw Error('Input required: token or app_id, app_installation_id, app_private_key');
            }
        }
        return token;
    }
    async run() {
        var _a, _b, _c, _d, _e, _f;
        if (utils_1.errorLoggingIssue) {
            const { repo, issue, owner } = utils_1.errorLoggingIssue;
            if (github_1.context.repo.repo === repo &&
                github_1.context.repo.owner === owner &&
                ((_a = github_1.context.payload.issue) === null || _a === void 0 ? void 0 : _a.number) === issue) {
                return (0, utils_1.safeLog)('refusing to run on error logging issue to prevent cascading errors');
            }
        }
        try {
            const token = await this.getToken();
            const readonly = !!(0, core_1.getInput)('readonly');
            const issue = (_b = github_1.context === null || github_1.context === void 0 ? void 0 : github_1.context.issue) === null || _b === void 0 ? void 0 : _b.number;
            if (issue) {
                const octokit = new octokit_1.OctoKitIssue(token, github_1.context.repo, { number: issue }, { readonly });
                if (github_1.context.eventName === 'issue_comment') {
                    await this.onCommented(octokit, (_c = github_1.context.payload.comment) === null || _c === void 0 ? void 0 : _c.body, github_1.context.actor);
                }
                else if (github_1.context.eventName === 'issues' ||
                    github_1.context.eventName === 'pull_request' ||
                    github_1.context.eventName === 'pull_request_target') {
                    switch (github_1.context.payload.action) {
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
                            await this.onLabeled(octokit, github_1.context.payload.label.name);
                            break;
                        case 'assigned':
                            await this.onAssigned(octokit, github_1.context.payload.assignee.login);
                            break;
                        case 'unassigned':
                            await this.onUnassigned(octokit, github_1.context.payload.assignee.login);
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
                            throw Error('Unexpected action: ' + github_1.context.payload.action);
                    }
                }
            }
            else if (github_1.context.eventName === 'create') {
                await this.onCreated(new octokit_1.OctoKit(token, github_1.context.repo, { readonly }), (_d = github_1.context === null || github_1.context === void 0 ? void 0 : github_1.context.payload) === null || _d === void 0 ? void 0 : _d.ref, (_f = (_e = github_1.context === null || github_1.context === void 0 ? void 0 : github_1.context.payload) === null || _e === void 0 ? void 0 : _e.sender) === null || _f === void 0 ? void 0 : _f.login);
            }
            else {
                await this.onTriggered(new octokit_1.OctoKit(token, github_1.context.repo, { readonly }));
            }
        }
        catch (e) {
            const err = e;
            (0, utils_1.safeLog)((err === null || err === void 0 ? void 0 : err.stack) || (err === null || err === void 0 ? void 0 : err.message) || String(e));
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
        var _a;
        console.log('::stop-commands::' + (0, uuid_1.v4)());
        const token = await this.getToken();
        const username = (0, github_1.getOctokit)(token)
            .rest.users.getAuthenticated()
            .then((v) => { var _a; return (_a = v.data.name) !== null && _a !== void 0 ? _a : 'unknown'; }, () => 'unknown');
        const details = {
            message: `${error.message}\n${error.stack}`,
            id: this.id,
            user: await username,
        };
        if ((_a = github_1.context.issue) === null || _a === void 0 ? void 0 : _a.number)
            details.issue = github_1.context.issue.number;
        const rendered = `
Message: ${details.message}

Actor: ${details.user}

ID: ${details.id}
`;
        await (0, utils_1.logErrorToIssue)(rendered, true, token);
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
//# sourceMappingURL=Action.js.map