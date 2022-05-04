"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../common/utils");
const Commands_1 = require("./Commands");
const Action_1 = require("../common/Action");
const github_1 = require("@actions/github");
const hydrate = (comment, issue) => {
    const baseQueryString = `https://github.com/${github_1.context.repo.owner}/${github_1.context.repo.repo}/issues?utf8=%E2%9C%93&q=is%3Aopen+is%3Aissue+`;
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
}
new CommandsRunner().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map