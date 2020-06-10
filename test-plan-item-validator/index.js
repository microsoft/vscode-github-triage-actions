"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../common/utils");
const TestPlanitemValidator_1 = require("./TestPlanitemValidator");
const Action_1 = require("../common/Action");
class TestPlanItemValidatorAction extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'TestPlanItemValidator';
    }
    async runValidation(issue) {
        await new TestPlanitemValidator_1.TestPlanItemValidator(issue, utils_1.getRequiredInput('label'), utils_1.getRequiredInput('invalidLabel'), utils_1.getRequiredInput('comment')).run();
    }
    async onLabeled(issue) {
        await this.runValidation(issue);
    }
    async onEdited(issue) {
        await this.runValidation(issue);
    }
}
new TestPlanItemValidatorAction().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map