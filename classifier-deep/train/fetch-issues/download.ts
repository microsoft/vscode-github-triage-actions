/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import axios from 'axios';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { getAuthenticationToken } from '../../../common/Action';
import { safeLog } from '../../../common/utils';

type Response = {
	rateLimit: RateLimitResponse;
	repository: { issues: IssueResponse };
};

type GHLabelEvent = {
	createdAt: string;
	__typename: 'LabeledEvent' | 'UnlabeledEvent';
	label: { name: string };
	actor: { login: string };
};
type GHRenameEvent = {
	createdAt: string;
	__typename: 'RenamedTitleEvent';
	currentTitle: string;
	previousTitle: string;
};

type GHCloseEvent = {
	__typename: 'ClosedEvent';
	closer: { __typename: 'Commit' | 'PullRequest' } | null;
};

type RateLimitResponse = { cost: number; remaining: number };
type IssueResponse = {
	pageInfo: { startCursor: string; hasPreviousPage: boolean };
	nodes: {
		body: string;
		title: string;
		number: number;
		createdAt: number;
		userContentEdits: { nodes: { editedAt: string; diff: string }[] };
		assignees: { nodes: { login: string }[] };
		labels: { nodes: { name: string; color: string }[] };
		timelineItems: {
			nodes: (GHLabelEvent | GHRenameEvent | GHCloseEvent)[];
		};
	}[];
};

export type JSONOutputLine = {
	number: number;
	title: string;
	body: string;
	createdAt: number;
	labels: { name: string; color: string }[];
	assignees: string[];
	labelEvents: LabelEvent[];
	closedWithCode: boolean;
};

export type LabelEvent = AddedLabelEvent | RemovedLabelEvent;

export type AddedLabelEvent = {
	type: 'added';
	label: string;
	actor: string;
	title: string;
	body: string;
};

export type RemovedLabelEvent = {
	type: 'removed';
	label: string;
};

export const download = async (
	repo: { owner: string; repo: string },
	startCursor?: string,
	isRetry = false,
) => {
	const token = await getAuthenticationToken();
	const data = await axios
		.post(
			'https://api.github.com/graphql',
			{
				query: `{
      repository(name: "${repo.repo}", owner: "${repo.owner}") {
        issues(last: 100 ${startCursor ? `before: "${startCursor}"` : ''}) {
          pageInfo {
            startCursor
            hasPreviousPage
          }
          nodes {
            body
            title
            number
            createdAt
            userContentEdits(first: 100) {
              nodes {
                editedAt
                diff
              }
            }
            assignees(first: 100) {
              nodes {
                login
              }
            }
            labels(first: 100) {
              nodes {
                name
                color
              }
            }
            timelineItems(itemTypes: [LABELED_EVENT, RENAMED_TITLE_EVENT, UNLABELED_EVENT, CLOSED_EVENT], first: 100) {
              nodes {
                __typename
                ... on UnlabeledEvent {
                  createdAt
                  label { name }
                }
                ... on LabeledEvent {
                  createdAt
                  label { name }
                  actor { login }
                }
                ... on RenamedTitleEvent {
                  createdAt
                  currentTitle
                  previousTitle
                }
                ... on ClosedEvent {
                  __typename
                }
              }
            }
          }
        }
      }
      rateLimit {
        cost
        remaining
      }
    }`,
			},
			{
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
					Authorization: 'bearer ' + token,
					'User-Agent': 'github-actions://microsoft/vscode-github-triage-actions#fetch-issues',
				},
			},
		)
		.then((r) => r.data);

	const response = data.data as Response;

	if (!response?.repository?.issues?.nodes) {
		safeLog('recieved unexpected response', JSON.stringify(data));
		if (isRetry) {
			console.error('max retries exceeded');
			return;
		}
		return new Promise<void>((resolve) => {
			setTimeout(async () => {
				await download(repo, startCursor, true);
				resolve();
			}, 60000);
		});
	}

	const issues: JSONOutputLine[] = response.repository.issues.nodes.map((issue) => ({
		number: issue.number,
		title: issue.title,
		body: issue.body,
		createdAt: +new Date(issue.createdAt),
		labels: issue.labels.nodes.map((label) => ({ name: label.name, color: label.color })),
		assignees: issue.assignees.nodes.map((assignee) => assignee.login),
		labelEvents: extractLabelEvents(issue),
		closedWithCode: !!issue.timelineItems.nodes.find(
			(event) =>
				event.__typename === 'ClosedEvent' &&
				(event.closer?.__typename === 'PullRequest' || event.closer?.__typename === 'Commit'),
		),
	}));

	writeFileSync(
		join(__dirname, 'issues.json'),
		issues.map((issue) => JSON.stringify(issue)).join('\n') + '\n',
		{
			flag: 'a',
		},
	);

	const pageInfo = response.repository.issues.pageInfo;
	const rateInfo = response.rateLimit;

	console.log({
		lastIssue: issues[issues.length - 1].number,
		quota: rateInfo.remaining,
		startCursor: pageInfo.startCursor,
	});

	startCursor = pageInfo.startCursor;
	if (pageInfo.hasPreviousPage) {
		return new Promise<void>((resolve) => {
			setTimeout(async () => {
				await download(repo, startCursor);
				resolve();
			}, 5000);
		});
	}
};

const extractLabelEvents = (_issue: IssueResponse['nodes'][number]): LabelEvent[] => {
	const issue = _issue;
	const events: ({ timestamp: number } & (
		| { type: 'labeled'; label: string; actor: string }
		| { type: 'titleEdited'; new: string; old: string }
		| { type: 'bodyEdited'; new: string }
		| { type: 'unlabeled'; label: string }
	))[] = [];

	events.push(
		...issue.userContentEdits.nodes.map(
			(node) => ({ timestamp: +new Date(node.editedAt), type: 'bodyEdited', new: node.diff } as const),
		),
	);

	events.push(
		...issue.timelineItems.nodes
			.filter((node): node is GHLabelEvent => node.__typename === 'LabeledEvent')
			.map((node) => ({ ...node, issue }))
			.map(
				(node) =>
					({
						timestamp: +new Date(node.createdAt),
						type: 'labeled',
						label: node.label.name,
						actor: node.actor?.login ?? 'ghost',
					} as const),
			),
	);

	events.push(
		...issue.timelineItems.nodes
			.filter((node): node is GHLabelEvent => node.__typename === 'UnlabeledEvent')
			.map(
				(node) =>
					({
						timestamp: +new Date(node.createdAt),
						type: 'unlabeled',
						label: node.label.name,
					} as const),
			),
	);

	events.push(
		...issue.timelineItems.nodes
			.filter((node): node is GHRenameEvent => node.__typename === 'RenamedTitleEvent')
			.map(
				(node) =>
					({
						timestamp: +new Date(node.createdAt),
						type: 'titleEdited',
						new: node.currentTitle,
						old: node.previousTitle,
					} as const),
			),
	);

	events.sort(({ timestamp: a }, { timestamp: b }) => a - b);

	let currentTitle = (events.find((event) => event.type === 'titleEdited') as any)?.old ?? issue.title;
	let currentBody = (events.find((event) => event.type === 'bodyEdited') as any)?.new ?? issue.body;

	const labelEvents: LabelEvent[] = [];
	for (const event of events) {
		if (event.type === 'labeled') {
			labelEvents.push({
				type: 'added',
				actor: event.actor,
				label: event.label,
				body: currentBody,
				title: currentTitle,
			});
		} else if (event.type === 'bodyEdited') {
			currentBody = event.new;
		} else if (event.type === 'titleEdited') {
			currentTitle = event.new;
		} else if (event.type === 'unlabeled') {
			labelEvents.push({ type: 'removed', label: event.label });
		}
	}

	return labelEvents;
};
