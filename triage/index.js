"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@actions/core");
const octokit_1 = require("../api/octokit");
const vscodeTools_1 = require("../api/vscodeTools");
const Action_1 = require("../common/Action");
const utils_1 = require("../common/utils");
class IssueTriageAction extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'IssueTriageAction';
    }
    async triage(issue, skipTeamCheck = false) {
        try {
            const githubIssue = await issue.getIssue();
            if (!githubIssue)
                return;
            const vscodeToolsAPI = new vscodeTools_1.VSCodeToolsAPIManager();
            const teamMembers = new Set((await vscodeToolsAPI.getTeamMembers()).map((t) => t.id));
            if (!skipTeamCheck && teamMembers.has(githubIssue.author.name)) {
                if (githubIssue.assignees.length === 0) {
                    const link = (0, core_1.getInput)('workingAreasLink');
                    if (link) {
                        await issue.postComment(`Hi @${githubIssue.author.name}. As a member of the team, you can help us triage this issue by referring to ${link}`);
                    }
                    else {
                        await issue.postComment(`Hi @${githubIssue.author.name}. You can help us triage this issue by assigning it to the appropriate person.`);
                    }
                }
                (0, utils_1.safeLog)('Author is a team member, skipping triaging', githubIssue.author.name);
                return;
            }
            // check to see that issue is not already assigned
            if (githubIssue.assignees.length > 0) {
                return;
            }
            await issue.addLabel('triage-needed');
            const assignees = (0, utils_1.getRequiredInput)('assignees').split('|');
            if (assignees.length === 0) {
                (0, utils_1.safeLog)('No assignees provided');
                return;
            }
            const triagers = await vscodeToolsAPI.getTriagerGitHubIds();
            if (triagers.length === 0) {
                (0, utils_1.safeLog)('No available triagers found');
                return;
            }
            const available = assignees.filter((assignee) => triagers.includes(assignee));
            if (available) {
                // Shuffle the array
                for (let i = available.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [available[i], available[j]] = [available[j], available[i]];
                }
                const randomSelection = available[0];
                (0, utils_1.safeLog)('assigning', randomSelection);
                await issue.addAssignee(randomSelection);
            }
            else {
                (0, utils_1.safeLog)('No available triagers');
            }
        }
        catch (e) {
            (0, utils_1.safeLog)('Error assigning random triager', e.message);
        }
    }
    async onOpened(issue) {
        // wait 1 minute before triaging
        await new Promise((resolve) => setTimeout(resolve, 60000));
        await this.triage(issue);
    }
    async onTriggered(_octokit) {
        const owner = (0, utils_1.getRequiredInput)('owner');
        const repo = (0, utils_1.getRequiredInput)('repo');
        const token = await (0, Action_1.getAuthenticationToken)();
        const staleIssues = _octokit.query({
            q: `is:issue is:open no:assignee no:label updated:<${(0, utils_1.daysAgoToHumanReadbleDate)(7)}`,
        });
        // Loop through issues which are not assigned and no labels and updated more than 7 days ago
        for await (const page of staleIssues) {
            for (const issueData of page) {
                const issue = await issueData.getIssue();
                if (!issue)
                    continue;
                const octokitIssue = new octokit_1.OctoKitIssue(token, { owner, repo }, { number: issue === null || issue === void 0 ? void 0 : issue.number });
                await this.triage(octokitIssue, true);
            }
        }
        (0, utils_1.safeLog)('Completed triaging stale issues.');
    }
}
new IssueTriageAction().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map