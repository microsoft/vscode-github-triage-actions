"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../common/utils");
const ReleasePipeline_1 = require("./ReleasePipeline");
const Action_1 = require("../common/Action");
const notYetReleasedLabel = utils_1.getRequiredInput('notYetReleasedLabel');
const insidersReleasedLabel = utils_1.getRequiredInput('insidersReleasedLabel');
class ReleasePipelineAction extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'ReleasePipeline';
    }
    async onReopened(issue) {
        await ReleasePipeline_1.unenrollIssue(issue, notYetReleasedLabel, insidersReleasedLabel);
    }
    async onClosed(issue) {
        await ReleasePipeline_1.enrollIssue(issue, notYetReleasedLabel);
    }
    async onTriggered(github) {
        await new ReleasePipeline_1.ReleasePipeline(github, notYetReleasedLabel, insidersReleasedLabel).run();
    }
}
new ReleasePipelineAction().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map