/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import axios from 'axios';
import { writeFileSync } from 'fs';
import { join } from 'path';

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

type GHCommentEvent = {
	__typename: 'IssueComment';
	author: { login: string };
	bodyText: string;
};

type RateLimitResponse = { cost: number; remaining: number };
type IssueResponse = {
	pageInfo: { endCursor: string; hasNextPage: boolean };
	nodes: {
		body: string;
		bodyText: string;
		title: string;
		number: number;
		createdAt: number;
		userContentEdits: { nodes: { editedAt: string; diff: string }[] };
		assignees: { nodes: { login: string }[] };
		labels: { nodes: { name: string }[] };
		timelineItems: {
			nodes: (GHLabelEvent | GHRenameEvent | GHCloseEvent | GHCommentEvent)[];
		};
	}[];
};

export type JSONOutputLine = {
	number: number;
	title: string;
	body: string;
	bodyText: string;
	createdAt: number;
	labels: string[];
	assignees: string[];
	labelEvents: LabelEvent[];
	commentEvents: CommentEvent[];
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

export type CommentEvent = {
	author: string;
	bodyText: string;
};

export const download = async (token: string, repo: { owner: string; repo: string }, endCursor?: string) => {
	const data = await axios
		.post(
			'https://api.github.com/graphql',
			JSON.stringify({
				query: `{
			repository(name: "${repo.repo}", owner: "${repo.owner}") {
				issues(first: 100 ${endCursor ? `after: "${endCursor}"` : ''}) {
					pageInfo {
						endCursor
						hasNextPage
					}
					nodes {
						body
						bodyText
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
							}
						}
						timelineItems(itemTypes: [LABELED_EVENT, RENAMED_TITLE_EVENT, UNLABELED_EVENT, CLOSED_EVENT, ISSUE_COMMENT], first: 250) {
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
								... on IssueComment {
									author { login }
									bodyText
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
			}),
			{
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
					Authorization: 'bearer ' + token,
				},
			},
		)
		.then((r) => r.data)
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});

	const response = data.data as Response;

	const issues: JSONOutputLine[] = response.repository.issues.nodes.map((issue) => ({
		number: issue.number,
		title: issue.title,
		body: issue.body,
		bodyText: issue.bodyText,
		createdAt: +new Date(issue.createdAt),
		labels: issue.labels.nodes.map((label) => label.name),
		assignees: issue.assignees.nodes.map((assignee) => assignee.login),
		labelEvents: extractLabelEvents(issue),
		commentEvents: extractCommentEvents(issue),
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
		endCursor: pageInfo.endCursor,
	});

	endCursor = pageInfo.endCursor;
	if (pageInfo.hasNextPage) {
		return new Promise<void>((resolve) => {
			setTimeout(async () => {
				await download(token, repo, endCursor);
				resolve();
			}, 1000);
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

function isCommentEvent(node: GHLabelEvent | GHRenameEvent | GHCloseEvent | GHCommentEvent): node is GHCommentEvent {
	return node.__typename === 'IssueComment';
}

const extractCommentEvents = (issue: IssueResponse['nodes'][number]): CommentEvent[] => {
	const result: CommentEvent[] = [];

	for (const node of issue.timelineItems.nodes) {
		if (isCommentEvent(node)) {
			result.push({
				author: node.author.login,
				bodyText: node.bodyText
			});
		}
	}

	return result;
};
