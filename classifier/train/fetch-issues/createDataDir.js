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
    {
        name: 'type',
        categoryPriority: ['bug', 'feature-request'],
        labelToCategory: {},
    },
    {
        name: 'area',
        categoryPriority: [
            'L10N',
            'VIM',
            'api',
            'authentication',
            'breadcrumbs',
            'callhierarchy',
            'color-palette',
            'comments',
            'config',
            'context-keys',
            'css-less-scss',
            'custom-editors',
            'debug-console',
            'debug',
            'dialogs',
            'diff-editor',
            'dropdown',
            'editor',
            'emmet',
            'error-list',
            'explorer-custom',
            'extension-host',
            'extension-recommendations',
            'extensions-development',
            'extensions',
            'file-decorations',
            'file-encoding',
            'file-explorer',
            'file-glob',
            'file-guess-encoding',
            'file-io',
            'file-watcher',
            'font-rendering',
            'formatting',
            'git',
            'gpu',
            'grammar',
            'grid-view',
            'html',
            'i18n',
            'icon-brand',
            'icons-product',
            'install-update',
            'integrated-terminal',
            'integration-test',
            'intellisense-config',
            'ipc',
            'issue-bot',
            'issue-reporter',
            'javascript',
            'json',
            'keyboard-layout',
            'keybindings',
            'keybindings-editor',
            'label-provider',
            'languages-diagnostics',
            'languages-basic',
            'languages-guessing',
            'layout',
            'lcd-text-rendering',
            'list',
            'log',
            'markdown',
            'marketplace',
            'menus',
            'merge-conflict',
            'notebook',
            'outline',
            'output',
            'perf',
            'perf-bloat',
            'perf-startup',
            'php',
            'portable-mode',
            'proxy',
            'quick-pick',
            'references-viewlet',
            'release-notes',
            'remote-explorer',
            'remote',
            'rename',
            'samples',
            'sandbox',
            'scm',
            'screencast-mode',
            'search-api',
            'search-editor',
            'search',
            'search-replace',
            'semantic-tokens',
            'settings-editor',
            'settings-sync-server',
            'settings-sync',
            'shared-process',
            'simple-file-dialog',
            'smart-select',
            'smoke-test',
            'snap',
            'snippets',
            'splitview',
            'suggest',
            'sync-error-handling',
            'tasks',
            'telemetry',
            'themes',
            'timeline-git',
            'timeline',
            'titlebar',
            'tokenization',
            'touch/pointer',
            'trackpad/scroll',
            'tree',
            'typescript',
            'undo-redo',
            'unit-test',
            'uri',
            'ux',
            'variable-resolving',
            'vscode-build',
            'vscode-website',
            'web',
            'webview',
            'workbench',
            'workspace-edit',
            'workspace-symbols',
            'zoom',
        ],
        labelToCategory: (category) => {
            if (category.startsWith('editor-')) {
                return 'editor';
            }
            if (category.startsWith('workbench-')) {
                return 'workbench';
            }
            return category.replace('/', '-');
        },
    },
    {
        name: 'editor',
        categoryPriority: (candidates) => candidates
            .sort()
            .find((candidate) => candidate.startsWith('editor-') && candidate !== 'editor-core'),
        labelToCategory: {},
    },
    {
        name: 'workbench',
        categoryPriority: (candidates) => candidates.sort().find((candidate) => candidate.startsWith('workbench-')),
        labelToCategory: {},
    },
];
exports.createDataDirectories = async (dataDir) => {
    var _a;
    const dumpFile = path.join(__dirname, 'issues.json');
    const issues = fs
        .readFileSync(dumpFile, { encoding: 'utf8' })
        .split('\n')
        .filter((l) => l)
        .map((l) => JSON.parse(l));
    for (const classification of classifications) {
        const { name, categoryPriority, labelToCategory } = classification;
        const labelToCategoryFn = typeof labelToCategory === 'function'
            ? labelToCategory
            : (label) => labelToCategory[label];
        const categoryPriorityFn = typeof categoryPriority === 'function'
            ? categoryPriority
            : (categories) => categoryPriority.find((candidate) => categories.indexOf(candidate) !== -1);
        const seen = {};
        for (const issue of issues) {
            const categories = issue.labels
                .map((label) => label)
                .map((label) => labelToCategoryFn(label) || label);
            const category = (_a = (dataDir === 'assignee' ? issue.assignees[0] : categoryPriorityFn(categories))) !== null && _a !== void 0 ? _a : (['*caused-by-extension', 'needs more info', '*question'].find((otherLabel) => issue.labels.includes(otherLabel))
                ? name === 'area' && Math.random() < 0.2
                    ? '__OTHER__'
                    : undefined
                : undefined);
            const isDuplicate = issue.labels.includes('*duplicate');
            const isHumanLabeled = !!issue.labelEvents.find((event) => event.type === 'added' &&
                event.label === category &&
                !['vscodebot', 'github-actions', 'vscode-triage-bot'].includes(event.actor));
            if (category && !isDuplicate && (isHumanLabeled || category === '__OTHER__')) {
                if (!seen[category]) {
                    seen[category] = true;
                    fs.mkdirSync(path.join(__dirname, '..', dataDir, name, 'train', category), {
                        recursive: true,
                    });
                    fs.mkdirSync(path.join(__dirname, '..', dataDir, name, 'test', category), {
                        recursive: true,
                    });
                    await new Promise((resolve) => setTimeout(resolve, 100)); // ?
                }
                const filepath = path.join(__dirname, '..', dataDir, name, Math.random() < 0.8 ? 'train' : 'test', category);
                const { title, body } = utils_1.normalizeIssue(issue);
                const filename = `${issue.number}.txt`;
                const content = `${title}\n\n${body}`;
                fs.writeFileSync(path.join(filepath, filename), content);
            }
        }
    }
};
//# sourceMappingURL=createDataDir.js.map