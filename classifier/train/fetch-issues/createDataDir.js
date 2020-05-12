"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const utils_1 = require("../../../utils/utils");
const classifications = [
    { name: 'raw', categoriesExtractor: () => ['issue'], categoryPriority: ['issue'], labelToCategory: {} },
];
const DATA_DIR = 'train_data';
exports.createDataDirectories = async () => {
    var _a;
    const dumpFile = path.join(__dirname, 'issues.json');
    const issues = fs
        .readFileSync(dumpFile, { encoding: 'utf8' })
        .split('\n')
        .filter((l) => l)
        .map((l) => JSON.parse(l));
    for (const classification of classifications) {
        const { name, categoryPriority, labelToCategory, categoriesExtractor } = classification;
        const labelToCategoryFn = typeof labelToCategory === 'function'
            ? labelToCategory
            : (label) => labelToCategory[label];
        const categoryPriorityFn = typeof categoryPriority === 'function'
            ? categoryPriority
            : (categories) => categoryPriority.find((candidate) => categories.indexOf(candidate) !== -1);
        const seen = {};
        const ignoredLabels = Object.entries(issues
            .map((issue) => issue.labels.map((label) => labelToCategoryFn(label) || label))
            .map((labels) => categoryPriorityFn(labels))
            .filter((x) => !!x)
            .reduce((record, label) => {
            var _a;
            record[label] = ((_a = record[label]) !== null && _a !== void 0 ? _a : 0) + 1;
            return record;
        }, {}))
            .filter(([_, count]) => count < 5)
            .map(([label]) => label);
        for (const issue of issues) {
            const category = (_a = categoryPriorityFn(categoriesExtractor(issue).map((label) => labelToCategoryFn(label) || label))) !== null && _a !== void 0 ? _a : (['*caused-by-extension', 'needs mo_re info', '*question'].find((otherLabel) => issue.labels.includes(otherLabel))
                ? name === 'area' && Math.random() < 0.2
                    ? '__OTHER__'
                    : undefined
                : undefined);
            const isDuplicate = issue.labels.includes('*duplicate');
            const isHumanLabeled = !!issue.labelEvents.find((event) => event.type === 'added' &&
                event.label === category &&
                !['vscodebot', 'github-actions', 'vscode-triage-bot'].includes(event.actor));
            if (category &&
                !ignoredLabels.includes(category) &&
                (name !== 'area' ||
                    (!isDuplicate && (isHumanLabeled || issue.closedWithCode || category === '__OTHER__')))) {
                if (!seen[category]) {
                    seen[category] = 0;
                    fs.mkdirSync(path.join(__dirname, '..', DATA_DIR, name, category), {
                        recursive: true,
                    });
                    await new Promise((resolve) => setTimeout(resolve, 100)); // ?
                }
                const filepath = path.join(__dirname, '..', DATA_DIR, name, category);
                const { title, body } = utils_1.normalizeIssue(issue);
                const filename = `${issue.number}.txt`;
                const content = `${title}\n\n${body}`;
                fs.writeFileSync(path.join(filepath, filename), content);
                seen[category]++;
            }
        }
        console.log('Ignored', ignoredLabels);
        console.log('Label Counts', seen);
    }
};
//# sourceMappingURL=createDataDir.js.map