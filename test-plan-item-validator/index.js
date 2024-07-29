"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const octokit_1 = require("../api/octokit");
const Action_1 = require("../common/Action");
const utils_1 = require("../common/utils");
const TestPlanitemValidator_1 = require("./TestPlanitemValidator");
class TestPlanItemValidatorAction extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'TestPlanItemValidator';
    }
    async runValidation(issue, token) {
        await new TestPlanitemValidator_1.TestPlanItemValidator(issue, token !== null && token !== void 0 ? token : (0, utils_1.getRequiredInput)('token'), (0, utils_1.getRequiredInput)('refLabel'), (0, utils_1.getRequiredInput)('label'), (0, utils_1.getRequiredInput)('invalidLabel'), (0, utils_1.getRequiredInput)('comment')).run();
    }
    async onOpened(issue) {
        await this.runValidation(issue);
    }
    async onLabeled(issue) {
        await this.runValidation(issue);
    }
    async onEdited(issue) {
        await this.runValidation(issue);
    }
    async onTriggered(_octokit) {
        // This function is only called during a manual workspace dispatch event
        // caused by a webhook, so we know to expect some inputs.
        const auth = await this.getToken();
        const repo = (0, utils_1.getRequiredInput)('repo');
        const owner = (0, utils_1.getRequiredInput)('owner');
        const issueNumber = +(0, utils_1.getRequiredInput)('issue_number');
        const octokitIssue = new octokit_1.OctoKitIssue(auth, { owner, repo }, { number: issueNumber });
        await this.runValidation(octokitIssue, auth);
    }
}
new TestPlanItemValidatorAction().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map