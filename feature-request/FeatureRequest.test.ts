/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { Comment } from '../api/api';
import { Testbed, TestbedIssue, TestbedIssueConstructorArgs } from '../api/testbed';
import {
	ACCEPT_MARKER,
	CREATE_MARKER,
	FeatureRequestConfig,
	FeatureRequestQueryer,
	REJECT_MARKER,
	WARN_MARKER,
} from './FeatureRequest';

const testConfig: FeatureRequestConfig = {
	milestones: {
		candidateName: 'candidateMilestoneName',
		candidateID: 1,
		backlogID: 2,
	},
	featureRequestLabel: 'featureRequestLabel',
	upvotesRequired: 3,
	numCommentsOverride: 4,
	labelsToExclude: [],
	comments: {
		init: 'initComment',
		warn: 'warnComment',
		accept: 'acceptComment',
		reject: 'rejectComment',
	},
	delays: {
		warn: 5,
		close: 6,
	},
};

const initalizeTestbed = (
	issueConfig: TestbedIssueConstructorArgs,
	comments: { body: string; daysAgo: number }[],
): { testbed: Testbed; issueTestbed: TestbedIssue } => {
	const issue = new TestbedIssue(
		{},
		{
			issue: issueConfig.issue,
			labels: issueConfig.labels,
			comments: comments.map((comment, index) => ({
				author: { name: 'rando' },
				body: comment.body,
				id: index,
				timestamp: Date.now() - comment.daysAgo * 24 * 60 * 60 * 1000,
			})),
		},
	);

	return {
		testbed: new Testbed({
			queryRunner: async function* () {
				yield [issue];
			},
		}),
		issueTestbed: issue,
	};
};

const getAllComments = async (issue: TestbedIssue): Promise<Comment[]> => {
	const comments: Comment[] = [];
	for await (const page of issue.getComments()) comments.push(...page);
	return comments;
};

describe('FeatureRequest', () => {
	describe('Queryer', () => {
		describe('Initial', () => {
			it('Does not add a comment to issues without the label', async () => {
				const { testbed, issueTestbed } = initalizeTestbed(
					{ issue: { milestoneId: testConfig.milestones.candidateID } },
					[],
				);
				await new FeatureRequestQueryer(testbed, testConfig).run();
				expect((await getAllComments(issueTestbed)).length).equal(0);
			});

			it('Does not add a comment to closed issues', async () => {
				const { testbed, issueTestbed } = initalizeTestbed(
					{
						issue: { open: false, milestoneId: testConfig.milestones.candidateID },
						labels: ['featureRequestLabel'],
					},
					[],
				);
				await new FeatureRequestQueryer(testbed, testConfig).run();
				expect((await getAllComments(issueTestbed)).length).equal(0);
			});

			it('Adds a comment to issues which have feature request label and candidate milestone but not init comment', async () => {
				const { testbed, issueTestbed } = initalizeTestbed(
					{
						issue: { milestoneId: testConfig.milestones.candidateID },
						labels: ['featureRequestLabel'],
					},
					[],
				);
				await new FeatureRequestQueryer(testbed, testConfig).run();
				expect((await getAllComments(issueTestbed)).length).equal(1);
				expect((await getAllComments(issueTestbed))[0].body).contains(CREATE_MARKER);
				expect((await getAllComments(issueTestbed))[0].body).contains('initComment');
			});

			it('Does not double add init comment', async () => {
				const { testbed, issueTestbed } = initalizeTestbed(
					{
						issue: { milestoneId: testConfig.milestones.candidateID },
						labels: ['featureRequestLabel'],
					},
					[],
				);
				await new FeatureRequestQueryer(testbed, testConfig).run();
				await new FeatureRequestQueryer(testbed, testConfig).run();
				expect((await getAllComments(issueTestbed)).length).equal(1);
			});
		});

		describe('Warning', () => {
			it('Adds a warning to issues which are nearing closure', async () => {
				const { testbed, issueTestbed } = initalizeTestbed(
					{
						issue: { milestoneId: testConfig.milestones.candidateID },
						labels: ['featureRequestLabel'],
					},
					[{ body: CREATE_MARKER + 'initComment', daysAgo: 2 }],
				);
				await new FeatureRequestQueryer(testbed, testConfig).run();
				expect((await getAllComments(issueTestbed)).length).equal(2);
				expect((await getAllComments(issueTestbed))[1].body).contains(WARN_MARKER);
				expect((await getAllComments(issueTestbed))[1].body).contains('warnComment');
			});

			it('Does not warn if the issue has a large conversation', async () => {
				const { testbed, issueTestbed } = initalizeTestbed(
					{
						issue: { milestoneId: testConfig.milestones.candidateID },
						labels: ['featureRequestLabel'],
					},
					[
						{ body: CREATE_MARKER + 'initComment', daysAgo: 2 },
						{ body: 'hello', daysAgo: 1.7 },
						{ body: 'cruel', daysAgo: 1.5 },
						{ body: 'cruel', daysAgo: 1.3 },
						{ body: 'world', daysAgo: 1 },
					],
				);
				await new FeatureRequestQueryer(testbed, testConfig).run();
				expect((await getAllComments(issueTestbed)).length).equal(5);
			});

			it('Does not double add a warning comment', async () => {
				const { testbed, issueTestbed } = initalizeTestbed(
					{
						issue: { milestoneId: testConfig.milestones.candidateID },
						labels: ['featureRequestLabel'],
					},
					[{ body: CREATE_MARKER + 'initComment', daysAgo: 2 }],
				);
				await new FeatureRequestQueryer(testbed, testConfig).run();
				await new FeatureRequestQueryer(testbed, testConfig).run();
				expect((await getAllComments(issueTestbed)).length).equal(2);
				expect((await getAllComments(issueTestbed))[1].body).contains(WARN_MARKER);
				expect((await getAllComments(issueTestbed))[1].body).contains('warnComment');
			});
		});

		describe('Rejecting', () => {
			it('Closes issues only after the proper days have passed since warning', async () => {
				const { testbed, issueTestbed } = initalizeTestbed(
					{
						issue: { milestoneId: testConfig.milestones.candidateID },
						labels: ['featureRequestLabel'],
					},
					[
						{ body: CREATE_MARKER + 'initComment', daysAgo: 7 },
						// warnComment delayed for wahtever reason. Issue should be closed until N days have passed, as thats that the warn comment says.
						{ body: WARN_MARKER + 'warnComment', daysAgo: 1 },
					],
				);
				await new FeatureRequestQueryer(testbed, testConfig).run();
				expect((await getAllComments(issueTestbed)).length).equal(2);
			});

			it('Closes & rejects issues which have not recieved enough upvotes', async () => {
				const { testbed, issueTestbed } = initalizeTestbed(
					{
						issue: { milestoneId: testConfig.milestones.candidateID },
						labels: ['featureRequestLabel'],
					},
					[
						{ body: CREATE_MARKER + 'initComment', daysAgo: 7 },
						{ body: WARN_MARKER + 'warnComment', daysAgo: 6 },
					],
				);
				await new FeatureRequestQueryer(testbed, testConfig).run();
				expect((await getAllComments(issueTestbed)).length).equal(3);
				expect((await getAllComments(issueTestbed))[2].body).contains(REJECT_MARKER);
				expect((await getAllComments(issueTestbed))[2].body).contains('rejectComment');
				expect(issueTestbed.issueConfig.issue.open).false;
			});

			it('Does not close issues which have an ongoing hearty conversation', async () => {
				const { testbed, issueTestbed } = initalizeTestbed(
					{
						issue: { milestoneId: testConfig.milestones.candidateID },
						labels: ['featureRequestLabel'],
					},
					[
						{ body: CREATE_MARKER + 'initComment', daysAgo: 7 },
						{ body: WARN_MARKER + 'warnComment', daysAgo: 6 },
						{ body: 'hello', daysAgo: 1.7 },
						{ body: 'cruel', daysAgo: 1.5 },
						{ body: 'cruel', daysAgo: 1.3 },
						{ body: 'world', daysAgo: 1 },
					],
				);
				await new FeatureRequestQueryer(testbed, testConfig).run();
				expect((await getAllComments(issueTestbed)).length).equal(6);
				expect(issueTestbed.issueConfig.issue.open).true;
			});
		});

		describe('Accepting', () => {
			it('Accepts issues which have sufficient upvotes', async () => {
				const { testbed, issueTestbed } = initalizeTestbed(
					{
						issue: {
							milestoneId: testConfig.milestones.candidateID,
							reactions: {
								'+1': 3,
								'-1': 0,
								confused: 0,
								eyes: 0,
								heart: 0,
								hooray: 0,
								laugh: 0,
								rocket: 0,
							},
						},
						labels: ['featureRequestLabel'],
					},
					[
						{ body: CREATE_MARKER + 'initComment', daysAgo: 7 },
						{ body: WARN_MARKER + 'warnComment', daysAgo: 6 },
						{ body: 'hello', daysAgo: 1.7 },
						{ body: 'cruel', daysAgo: 1.5 },
						{ body: 'cruel', daysAgo: 1.3 },
						{ body: 'world', daysAgo: 1 },
					],
				);
				await new FeatureRequestQueryer(testbed, testConfig).run();
				expect((await getAllComments(issueTestbed)).length).equal(7);
				expect(issueTestbed.issueConfig.issue.open).true;
				expect(issueTestbed.issueConfig.issue.milestoneId).equal(2);
				expect((await getAllComments(issueTestbed))[6].body).contains(ACCEPT_MARKER);
				expect((await getAllComments(issueTestbed))[6].body).contains('acceptComment');
			});

			it('Doesnt accept issues which simply have enough of any reactions', async () => {
				const { testbed, issueTestbed } = initalizeTestbed(
					{
						issue: {
							milestoneId: testConfig.milestones.candidateID,
							reactions: {
								'+1': 1,
								'-1': 1,
								confused: 1,
								eyes: 1,
								heart: 1,
								hooray: 1,
								laugh: 1,
								rocket: 1,
							},
						},
						labels: ['featureRequestLabel'],
					},
					[{ body: CREATE_MARKER + 'initComment', daysAgo: 0 }],
				);
				await new FeatureRequestQueryer(testbed, testConfig).run();
				expect((await getAllComments(issueTestbed)).length).equal(1);
			});
		});
	});
});
