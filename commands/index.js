"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const octokit_1 = require("../api/octokit");
const Action_1 = require("../common/Action");
const utils_1 = require("../common/utils");
const Commands_1 = require("./Commands");
const repository = JSON.parse((0, utils_1.getRequiredInput)('repository'));
const hydrate = (comment, issue) => {
    const baseQueryString = `https://github.com/${repository.owner.login}/${repository.name}/issues?utf8=%E2%9C%93&q=is%3Aopen+is%3Aissue+`;
    const importantLabels = issue.labels.filter((label) => label !== '*duplicate');
    const labelsQueryString = encodeURIComponent(importantLabels.map((label) => `label:"${label}"`).join(' '));
    const url = baseQueryString + labelsQueryString;
    return comment.replace('${duplicateQuery}', url).replace('${author}', issue.author.name);
};
class CommandsRunner extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'Commands';
    }
    async onCommented(issue, comment, actor) {
        const commands = await issue.readConfig((0, utils_1.getRequiredInput)('config-path'));
        await new Commands_1.Commands(issue, commands, { comment, user: { name: actor } }, hydrate).run();
    }
    async onLabeled(issue, label) {
        const commands = await issue.readConfig((0, utils_1.getRequiredInput)('config-path'));
        await new Commands_1.Commands(issue, commands, { label }, hydrate).run();
    }
    async onTriggered() {
        // This function is only called during a manual workspace dispatch event
        // caused by a webhook, so we know to expect some inputs.
        const auth = await this.getToken();
        const event = (0, utils_1.getRequiredInput)('event');
        const issue = JSON.parse((0, utils_1.getRequiredInput)('issue'));
        const octokitIssue = new octokit_1.OctoKitIssue(auth, { owner: repository.owner.login, repo: repository.name }, { number: issue.number });
        if (event === 'issue_comment') {
            const commentObject = JSON.parse((0, utils_1.getRequiredInput)('comment'));
            const comment = commentObject.body;
            const actor = commentObject.user.login;
            const commands = await octokitIssue.readConfig((0, utils_1.getRequiredInput)('config-path'), 'vscode-engineering');
            await new Commands_1.Commands(octokitIssue, commands, { comment, user: { name: actor } }, hydrate).run();
        }
        else if (event === 'issues') {
            const action = (0, utils_1.getRequiredInput)('action');
            if (action !== 'labeled') {
                return;
            }
            for (const label of issue.labels) {
                const commands = await octokitIssue.readConfig((0, utils_1.getRequiredInput)('config-path'), 'vscode-engineering');
                await new Commands_1.Commands(octokitIssue, commands, { label: label.name }, hydrate).run();
            }
        }
        return;
    }
}
new CommandsRunner().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map