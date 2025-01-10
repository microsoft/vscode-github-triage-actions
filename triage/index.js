"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscodeTools_1 = require("../api/vscodeTools");
const Action_1 = require("../common/Action");
const utils_1 = require("../common/utils");
class IssueTriageAction extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'IssueTriageAction';
    }
    async triage(issue) {
        try {
            const githubIssue = await issue.getIssue();
            if (!githubIssue)
                return;
            // check to see that issue is not already assigned and that it does not have the triage-needed label
            if (githubIssue.assignees.length > 0 || githubIssue.labels.length > 0) {
                return;
            }
            await issue.addLabel('triage-needed');
            const assignees = (0, utils_1.getRequiredInput)('assignees').split('|');
            if (assignees.length === 0) {
                (0, utils_1.safeLog)('No assignees provided');
                return;
            }
            const vscodeToolsAPI = new vscodeTools_1.VSCodeToolsAPIManager();
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
        // wait 30 seconds before triaging
        await new Promise((resolve) => setTimeout(resolve, 30000));
        await this.triage(issue);
    }
}
new IssueTriageAction().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map