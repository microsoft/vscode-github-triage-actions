"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.OctoKitIssue = exports.OctoKit = exports.getNumRequests = void 0;
const github_1 = require("@actions/github");
const child_process_1 = require("child_process");
const utils_1 = require("../common/utils");
let numRequests = 0;
const getNumRequests = () => numRequests;
exports.getNumRequests = getNumRequests;
class OctoKit {
    constructor(token, params, options = { readonly: false }) {
        this.token = token;
        this.params = params;
        this.options = options;
        // when in readonly mode, record labels just-created so at to not throw unneccesary errors
        this.mockLabels = new Set();
        this.writeAccessCache = {};
        this._octokit = new github_1.GitHub(token);
    }
    get octokit() {
        numRequests++;
        return this._octokit;
    }
    getIssueByNumber(number) {
        return new OctoKitIssue(this.token, this.params, { number: number });
    }
    // TODO: just iterate over the issues in a page here instead of making caller do it
    async *query(query) {
        const q = query.q + ` repo:${this.params.owner}/${this.params.repo}`;
        const options = this.octokit.search.issuesAndPullRequests.endpoint.merge({
            ...query,
            q,
            per_page: 100,
            headers: { Accept: 'application/vnd.github.squirrel-girl-preview+json' },
        });
        let pageNum = 0;
        const timeout = async () => {
            if (pageNum < 2) {
                /* pass */
            }
            else if (pageNum < 4) {
                await new Promise((resolve) => setTimeout(resolve, 10000));
            }
            else {
                await new Promise((resolve) => setTimeout(resolve, 30000));
            }
        };
        for await (const pageResponse of this.octokit.paginate.iterator(options)) {
            await timeout();
            numRequests++;
            const page = pageResponse.data;
            (0, utils_1.safeLog)(`Page ${++pageNum}: ${page.map(({ number }) => number).join(' ')}`);
            yield page.map((issue) => new OctoKitIssue(this.token, this.params, this.octokitIssueToIssue(issue), this.options));
        }
    }
    async createIssue(owner, repo, title, body) {
        (0, utils_1.safeLog)(`Creating issue \`${title}\` on ${owner}/${repo}`);
        if (!this.options.readonly)
            await this.octokit.issues.create({ owner, repo, title, body });
    }
    octokitIssueToIssue(issue) {
        var _a, _b, _c, _d, _e, _f, _g;
        return {
            author: { name: issue.user.login, isGitHubApp: issue.user.type === 'Bot' },
            body: issue.body,
            number: issue.number,
            title: issue.title,
            isPr: !!((_a = issue.pull_request) === null || _a === void 0 ? void 0 : _a.html_url),
            labels: issue.labels.map((label) => label.name),
            open: issue.state === 'open',
            locked: issue.locked,
            numComments: issue.comments,
            reactions: issue.reactions,
            assignee: (_c = (_b = issue.assignee) === null || _b === void 0 ? void 0 : _b.login) !== null && _c !== void 0 ? _c : (_e = (_d = issue.assignees) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.login,
            assignees: (_g = (_f = issue.assignees) === null || _f === void 0 ? void 0 : _f.map((assignee) => assignee.login)) !== null && _g !== void 0 ? _g : [],
            milestone: issue.milestone ? this.octokitMilestoneToMilestone(issue.milestone) : null,
            createdAt: +new Date(issue.created_at),
            updatedAt: +new Date(issue.updated_at),
            closedAt: issue.closed_at ? +new Date(issue.closed_at) : undefined,
        };
    }
    octokitMilestoneToMilestone(milestone) {
        return {
            title: milestone.title,
            milestoneId: milestone.id,
            // Remove the time portions of the dates as they're not important
            createdAt: milestone.created_at !== null ? new Date(milestone.created_at.split('T')[0]) : null,
            dueOn: milestone.due_on !== null ? new Date(milestone.due_on.split('T')[0]) : null,
            closedAt: milestone.closed_at !== null ? new Date(milestone.closed_at.split('T')[0]) : null,
            description: milestone.description,
            numClosedIssues: milestone.closed_issues,
            numOpenIssues: milestone.open_issues,
            state: milestone.state === 'open' ? 'open' : 'closed',
        };
    }
    async hasWriteAccess(user) {
        if (user.name in this.writeAccessCache) {
            (0, utils_1.safeLog)('Got permissions from cache for ' + user);
            return this.writeAccessCache[user.name];
        }
        (0, utils_1.safeLog)('Fetching permissions for ' + user);
        const permissions = (await this.octokit.repos.getCollaboratorPermissionLevel({
            ...this.params,
            username: user.name,
        })).data.permission;
        return (this.writeAccessCache[user.name] = permissions === 'admin' || permissions === 'write');
    }
    async repoHasLabel(name) {
        try {
            await this.octokit.issues.getLabel({ ...this.params, name });
            return true;
        }
        catch (err) {
            const statusErorr = err;
            if (statusErorr.status === 404) {
                return this.options.readonly && this.mockLabels.has(name);
            }
            throw err;
        }
    }
    async createLabel(name, color, description) {
        (0, utils_1.safeLog)('Creating label ' + name);
        if (!this.options.readonly)
            await this.octokit.issues.createLabel({ ...this.params, color, description, name });
        else
            this.mockLabels.add(name);
    }
    async deleteLabel(name) {
        (0, utils_1.safeLog)('Deleting label ' + name);
        try {
            if (!this.options.readonly)
                await this.octokit.issues.deleteLabel({ ...this.params, name });
        }
        catch (err) {
            const statusErorr = err;
            if (statusErorr.status === 404) {
                return;
            }
            throw err;
        }
    }
    async readConfig(path) {
        (0, utils_1.safeLog)('Reading config at ' + path);
        const repoPath = `.github/${path}.json`;
        try {
            const data = (await this.octokit.repos.getContents({ ...this.params, path: repoPath })).data;
            if ('type' in data && data.type === 'file') {
                if (data.encoding === 'base64' && data.content) {
                    return JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));
                }
                throw Error(`Could not read contents "${data.content}" in encoding "${data.encoding}"`);
            }
            throw Error('Found directory at config path when expecting file' + JSON.stringify(data));
        }
        catch (e) {
            throw Error('Error with config file at ' + repoPath + ': ' + JSON.stringify(e));
        }
    }
    async releaseContainsCommit(release, commit) {
        const isHash = (s) => /^[a-fA-F0-9]*$/.test(s);
        if (!isHash(release) || !isHash(commit))
            return 'unknown';
        return new Promise((resolve, reject) => (0, child_process_1.exec)(`git -C ./repo merge-base --is-ancestor ${commit} ${release}`, (err) => {
            if (!err || err.code === 1) {
                resolve(!err ? 'yes' : 'no');
            }
            else if (err.message.includes(`Not a valid commit name ${release}`)) {
                // release branch is forked. Probably in endgame. Not released.
                resolve('no');
            }
            else if (err.message.includes(`Not a valid commit name ${commit}`)) {
                // commit is probably in a different repo.
                resolve('unknown');
            }
            else {
                reject(err);
            }
        }));
    }
    async dispatch(title) {
        (0, utils_1.safeLog)('Dispatching ' + title);
        if (!this.options.readonly)
            await this.octokit.repos.createDispatchEvent({ ...this.params, event_type: title });
    }
}
exports.OctoKit = OctoKit;
class OctoKitIssue extends OctoKit {
    constructor(token, params, issueData, options = { readonly: false }) {
        super(token, params, options);
        this.params = params;
        this.issueData = issueData;
        (0, utils_1.safeLog)('running bot on issue', issueData.number);
    }
    async addAssignee(assignee) {
        (0, utils_1.safeLog)('Adding assignee ' + assignee + ' to ' + this.issueData.number);
        if (!this.options.readonly) {
            await this.octokit.issues.addAssignees({
                ...this.params,
                issue_number: this.issueData.number,
                assignees: [assignee],
            });
        }
    }
    async removeAssignee(assignee) {
        (0, utils_1.safeLog)('Removing assignee ' + assignee + ' to ' + this.issueData.number);
        if (!this.options.readonly) {
            await this.octokit.issues.removeAssignees({
                ...this.params,
                issue_number: this.issueData.number,
                assignees: [assignee],
            });
        }
    }
    async closeIssue() {
        (0, utils_1.safeLog)('Closing issue ' + this.issueData.number);
        if (!this.options.readonly)
            await this.octokit.issues
                .update({
                ...this.params,
                issue_number: this.issueData.number,
                state: 'closed',
            })
                .catch((e) => {
                (0, utils_1.safeLog)('error closing issue:', e);
            });
    }
    async lockIssue() {
        (0, utils_1.safeLog)('Locking issue ' + this.issueData.number);
        if (!this.options.readonly)
            await this.octokit.issues.lock({ ...this.params, issue_number: this.issueData.number });
    }
    async unlockIssue() {
        (0, utils_1.safeLog)('Unlocking issue ' + this.issueData.number);
        if (!this.options.readonly)
            await this.octokit.issues.unlock({ ...this.params, issue_number: this.issueData.number });
    }
    async getIssue() {
        if (isIssue(this.issueData)) {
            (0, utils_1.safeLog)('Got issue data from query result ' + this.issueData.number);
            return this.issueData;
        }
        (0, utils_1.safeLog)('Fetching issue ' + this.issueData.number);
        const issue = (await this.octokit.issues.get({
            ...this.params,
            issue_number: this.issueData.number,
            mediaType: { previews: ['squirrel-girl'] },
        })).data;
        return (this.issueData = this.octokitIssueToIssue(issue));
    }
    async postComment(body) {
        (0, utils_1.safeLog)(`Posting comment on ${this.issueData.number}`);
        if (!this.options.readonly)
            await this.octokit.issues.createComment({
                ...this.params,
                issue_number: this.issueData.number,
                body,
            });
    }
    async deleteComment(id) {
        (0, utils_1.safeLog)(`Deleting comment ${id} on ${this.issueData.number}`);
        if (!this.options.readonly)
            await this.octokit.issues.deleteComment({
                owner: this.params.owner,
                repo: this.params.repo,
                comment_id: id,
            });
    }
    async setMilestone(milestoneId) {
        (0, utils_1.safeLog)(`Setting milestone for ${this.issueData.number} to ${milestoneId}`);
        if (!this.options.readonly)
            await this.octokit.issues.update({
                ...this.params,
                issue_number: this.issueData.number,
                milestone: milestoneId,
            });
    }
    async getCurrentRepoMilestone() {
        (0, utils_1.safeLog)(`Getting repo milestone for ${this.issueData.number}`);
        // Fetch all milestones open for this repo
        const allMilestones = (await this.octokit.issues.listMilestonesForRepo({
            owner: this.params.owner,
            repo: this.params.repo,
            state: 'open',
            sort: 'due_on',
            direction: 'asc',
        })).data;
        const currentDate = new Date();
        const possibleMilestones = allMilestones.filter((milestone) => new Date(milestone.due_on) > currentDate && currentDate > new Date(milestone.created_at));
        if (possibleMilestones.length === 0) {
            return undefined;
        }
        return possibleMilestones[0].id;
    }
    async *getComments(last) {
        (0, utils_1.safeLog)('Fetching comments for ' + this.issueData.number);
        const response = this.octokit.paginate.iterator(this.octokit.issues.listComments.endpoint.merge({
            ...this.params,
            issue_number: this.issueData.number,
            per_page: 100,
            ...(last ? { per_page: 1, page: (await this.getIssue()).numComments } : {}),
        }));
        for await (const page of response) {
            numRequests++;
            yield page.data.map((comment) => ({
                author: { name: comment.user.login, isGitHubApp: comment.user.type === 'Bot' },
                body: comment.body,
                id: comment.id,
                timestamp: +new Date(comment.created_at),
            }));
        }
    }
    async addLabel(name) {
        (0, utils_1.safeLog)(`Adding label ${name} to ${this.issueData.number}`);
        if (!(await this.repoHasLabel(name))) {
            throw Error(`Action could not execute becuase label ${name} is not defined.`);
        }
        if (!this.options.readonly)
            await this.octokit.issues.addLabels({
                ...this.params,
                issue_number: this.issueData.number,
                labels: [name],
            });
    }
    async getAssigner(assignee) {
        const options = this.octokit.issues.listEventsForTimeline.endpoint.merge({
            ...this.params,
            issue_number: this.issueData.number,
        });
        let assigner;
        for await (const event of this.octokit.paginate.iterator(options)) {
            numRequests++;
            const timelineEvents = event.data;
            for (const timelineEvent of timelineEvents) {
                if (timelineEvent.event === 'assigned' &&
                    timelineEvent.assignee.login === assignee) {
                    assigner = timelineEvent.actor.login;
                }
            }
            if (assigner) {
                break;
            }
        }
        if (!assigner) {
            throw Error('Expected to find ' + assignee + ' in issue timeline but did not.');
        }
        return assigner;
    }
    async removeLabel(name) {
        (0, utils_1.safeLog)(`Removing label ${name} from ${this.issueData.number}`);
        try {
            if (!this.options.readonly)
                await this.octokit.issues.removeLabel({
                    ...this.params,
                    issue_number: this.issueData.number,
                    name,
                });
        }
        catch (err) {
            const statusErorr = err;
            if (statusErorr.status === 404) {
                (0, utils_1.safeLog)(`Label ${name} not found on issue`);
                return;
            }
            throw err;
        }
    }
    async getClosingInfo(alreadyChecked = []) {
        var _a, _b, _c, _d, _e, _f, _g;
        if (alreadyChecked.includes(this.issueData.number)) {
            return undefined;
        }
        alreadyChecked.push(this.issueData.number);
        if ((await this.getIssue()).open) {
            return;
        }
        const closingHashComment = /(?:\\|\/)closedWith (?:https:\/\/github\.com\/microsoft\/vscode\/commit\/)?([a-fA-F0-9]{7,40})/;
        const options = this.octokit.issues.listEventsForTimeline.endpoint.merge({
            ...this.params,
            issue_number: this.issueData.number,
        });
        let closingCommit;
        const crossReferencing = [];
        for await (const event of this.octokit.paginate.iterator(options)) {
            numRequests++;
            const timelineEvents = event.data;
            for (const timelineEvent of timelineEvents) {
                if ((timelineEvent.event === 'closed' || timelineEvent.event === 'merged') &&
                    timelineEvent.commit_id &&
                    timelineEvent.commit_url
                        .toLowerCase()
                        .includes(`/${this.params.owner}/${this.params.repo}/`.toLowerCase())) {
                    closingCommit = {
                        hash: timelineEvent.commit_id,
                        timestamp: +new Date(timelineEvent.created_at),
                    };
                }
                if (timelineEvent.event === 'reopened') {
                    closingCommit = undefined;
                }
                if (timelineEvent.event === 'commented' &&
                    !((_a = timelineEvent.body) === null || _a === void 0 ? void 0 : _a.includes('UNABLE_TO_LOCATE_COMMIT_MESSAGE')) &&
                    closingHashComment.test(timelineEvent.body)) {
                    closingCommit = {
                        hash: closingHashComment.exec(timelineEvent.body)[1],
                        timestamp: +new Date(timelineEvent.created_at),
                    };
                }
                if (timelineEvent.event === 'cross-referenced' &&
                    ((_c = (_b = timelineEvent.source) === null || _b === void 0 ? void 0 : _b.issue) === null || _c === void 0 ? void 0 : _c.number) &&
                    ((_f = (_e = (_d = timelineEvent.source) === null || _d === void 0 ? void 0 : _d.issue) === null || _e === void 0 ? void 0 : _e.pull_request) === null || _f === void 0 ? void 0 : _f.url.includes(`/${this.params.owner}/${this.params.repo}/`.toLowerCase()))) {
                    crossReferencing.push(timelineEvent.source.issue.number);
                }
            }
        }
        // If we dont have any closing info, try to get it from linked issues (PRs).
        // If there's a linked issue that was closed at almost the same time, guess it was a PR that closed this.
        if (!closingCommit) {
            for (const id of crossReferencing.reverse()) {
                const closed = await new OctoKitIssue(this.token, this.params, {
                    number: id,
                }).getClosingInfo(alreadyChecked);
                if (closed) {
                    if (Math.abs(closed.timestamp - ((_g = (await this.getIssue()).closedAt) !== null && _g !== void 0 ? _g : 0)) < 5000) {
                        closingCommit = closed;
                        break;
                    }
                }
            }
        }
        (0, utils_1.safeLog)(`Got ${JSON.stringify(closingCommit)} as closing commit of ${this.issueData.number}`);
        return closingCommit;
    }
}
exports.OctoKitIssue = OctoKitIssue;
function isIssue(object) {
    const isIssue = 'author' in object &&
        'body' in object &&
        'title' in object &&
        'labels' in object &&
        'open' in object &&
        'locked' in object &&
        'number' in object &&
        'numComments' in object &&
        'reactions' in object &&
        'milestoneId' in object;
    return isIssue;
}
//# sourceMappingURL=octokit.js.map