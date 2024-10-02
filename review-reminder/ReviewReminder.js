"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewReminder = void 0;
const rest_1 = require("@octokit/rest");
const web_api_1 = require("@slack/web-api");
const utils_1 = require("../common/utils");
class ReviewReminder {
    constructor(gitHubToken, slackToken, toolsAPI) {
        this.toolsAPI = toolsAPI;
        this.slackClient = new web_api_1.WebClient(slackToken);
        this.octokit = new rest_1.Octokit({ auth: gitHubToken });
    }
    static reviewWarningMessage(numberOfReviews, topReviewer) {
        const headerBlock = {
            type: 'header',
            text: {
                type: 'plain_text',
                text: 'Review reminder',
                emoji: true,
            },
        };
        const messageBlock = {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `You've completed *${numberOfReviews}* code reviews in the past 7 days. Thank you! If you were wondering, the top reviewer has completed ${topReviewer} reviews in the past 7 days. Just a friendly reminder to keep an eye on the #codereview channel!`,
            },
        };
        return [headerBlock, { type: 'divider' }, messageBlock];
    }
    static topReviewerMessage(numberOfReviewsPatWeek, numberOfReviewsPastMonth, place) {
        const medalEmoji = place === 'first' ? '🥇' : place === 'second' ? '🥈' : '🥉';
        const headerBlock = {
            type: 'header',
            text: {
                type: 'plain_text',
                text: `Top reviewer this week! ${medalEmoji}`,
                emoji: true,
            },
        };
        const messageBlock = {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `Thank you for helping out with code reviews this week! You have completed *${numberOfReviewsPatWeek}* reviews in the past 7 days, putting you in ${place}! In the past 30 days you have completed an amazing *${numberOfReviewsPastMonth}* reviews! You're awesome 🎉🎉🎉`,
            },
        };
        return [headerBlock, { type: 'divider' }, messageBlock];
    }
    /**
     * A generator which returns the next repo managed by VS Code
     * @param octokit The octokit API object
     */
    async *getRepositories(octokit) {
        // Inject a few extra repos that aren't in the VS Code org
        yield { owner: { login: 'microsoft' }, name: 'vscode-jupyter' };
        yield { owner: { login: 'microsoft' }, name: 'vscode-python' };
        const it = octokit.paginate.iterator(octokit.rest.apps.listReposAccessibleToInstallation, {
            per_page: 100,
        });
        for await (const { data: repositories } of it) {
            const repos = Array.isArray(repositories)
                ? repositories
                : [];
            if (repositories.repositories) {
                repos.push(...repositories.repositories);
            }
            for (const repository of repos) {
                if (repository.archived) {
                    continue;
                }
                yield repository;
            }
        }
    }
    /**
     * Collects information about reviewers for a given repository
     * @param octokit The octokit API object
     * @param repositoryInfo The owner and repo name of the repository to process
     * @returns A data object containing information about the reviews for the repository
     */
    async processRepository(octokit, repositoryInfo, teamMembers, numberOfDays = 30) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const data = [];
        const durations = [];
        console.log(`Processing ${repositoryInfo.owner}/${repositoryInfo.repo}`);
        // The timeslot to query for
        const timeWindowToQuery = new Date();
        timeWindowToQuery.setDate(timeWindowToQuery.getDate() - numberOfDays);
        for await (const response of octokit.paginate.iterator(octokit.rest.pulls.list, {
            owner: repositoryInfo.owner,
            repo: repositoryInfo.repo,
            state: 'closed',
            per_page: 100,
            sort: 'created',
            direction: 'desc',
        })) {
            let pastTimeInterval = false;
            for (const pr of response.data) {
                const hasWriteAccess = teamMembers.has((_b = (_a = pr.user) === null || _a === void 0 ? void 0 : _a.login) !== null && _b !== void 0 ? _b : 'No Member');
                // Author isn't in the team, so we skip this PR
                if (!hasWriteAccess) {
                    continue;
                }
                // If PR is over a week old then stop
                if (new Date(pr.created_at) < timeWindowToQuery) {
                    pastTimeInterval = true;
                    break;
                }
                // If the PR is reviewed but not merged, then we don't count it
                if (!pr.merged_at) {
                    continue;
                }
                const reviews = await octokit.rest.pulls.listReviews({
                    owner: repositoryInfo.owner,
                    repo: repositoryInfo.repo,
                    pull_number: pr.number,
                });
                const first = {
                    reviewer: 'void',
                    submitted_at: new Date().toString(),
                    submitted_ts: Date.now(),
                };
                for (const review of reviews.data) {
                    // Reviews from the author don't count
                    if (((_c = review.user) === null || _c === void 0 ? void 0 : _c.login) === ((_d = pr.user) === null || _d === void 0 ? void 0 : _d.login)) {
                        continue;
                    }
                    // We only want to count reviews from another team member
                    if (!teamMembers.has((_f = (_e = review.user) === null || _e === void 0 ? void 0 : _e.login) !== null && _f !== void 0 ? _f : 'No Member')) {
                        continue;
                    }
                    if (!review.submitted_at) {
                        console.log('BOGOUS', review);
                        continue;
                    }
                    const ts = new Date(review.submitted_at).getTime();
                    if (ts < first.submitted_ts) {
                        first.submitted_ts = ts;
                        first.submitted_at = review.submitted_at;
                        first.reviewer = (_h = (_g = review.user) === null || _g === void 0 ? void 0 : _g.login) !== null && _h !== void 0 ? _h : 'MISSING';
                    }
                }
                if (first.reviewer === 'void') {
                    console.log(`SKIPPING, no reviews: ${pr.html_url}`);
                    continue;
                }
                // TODO @lramos15 add this piece back in if we care about whether it was from the #codereview channel. This slows down the query though
                // const timeline = await octokit.rest.issues.listEventsForTimeline({
                // 	owner: repositoryInfo.owner,
                // 	repo: repositoryInfo.repo,
                // 	issue_number: pr.number,
                // 	per_page: 100,
                // });
                // const requestedReviewers = timeline.data
                // 	.filter((t) => t.event === 'review_requested')
                // 	.map((r) => r.requested_reviewer?.login ?? 'Unknown');
                const wasRequested = true;
                const duration = first.submitted_ts - new Date(pr.created_at).getTime();
                durations.push(duration);
                data.push({
                    prUrl: pr.html_url,
                    prAssignee: (_j = pr.assignee) === null || _j === void 0 ? void 0 : _j.login,
                    createdAt: pr.created_at,
                    submittedAt: first.submitted_at,
                    timeToReview: duration / (1000 * 60),
                    reviewer: first.reviewer,
                    wasRequestedReviewer: wasRequested,
                });
            }
            if (pastTimeInterval) {
                break;
            }
        }
        // No PRs found
        if (data.length === 0) {
            return [];
        }
        console.log(`PR Stats for ${repositoryInfo.owner}/${repositoryInfo.repo}`);
        // median duration
        const median = durations.sort()[durations.length === 1 ? 0 : Math.ceil(durations.length / 2)];
        console.log(`MEDIAN time to review ${median / (1000 * 60)}mins`);
        const avg = durations.reduce((p, c) => p + c, 0) / durations.length;
        console.log(`AVG time to review ${avg / (1000 * 60)}mins`);
        return data;
    }
    /**
     * Takes a map of names to numbers and returns the bottom x percent of the map
     * @param stats The stats to process
     * @param percentile What bottom percentile you want i.e. .1 for 10%
     * @returns A new map containing the bottom percentile of the stats
     */
    async getBottomPercent(stats, percentile) {
        const sorted = [...stats.entries()].sort((a, b) => a[1] - b[1]);
        const bottom = Math.ceil(sorted.length * percentile);
        return new Map(sorted.slice(0, bottom));
    }
    /**
     * Loops through all the repositories collecting statistics about PR reviews
     * @param teamMembers The map of team members to their various accounts
     * @returns A set of review stats regarding reviews completed
     */
    async processAllRepositories(teamMembers) {
        var _a, _b, _c, _d, _e, _f;
        let data = [];
        for await (const repository of this.getRepositories(this.octokit)) {
            const owner = repository.owner.login;
            const repo = repository.name;
            data = data.concat(await this.processRepository(this.octokit, { owner, repo }, teamMembers));
        }
        // Calculate number of reviews done by each reviewer
        const monthlyStats = new Map();
        const weeklyStats = new Map();
        // Intialize the map with all team members
        for (const member of teamMembers.values()) {
            monthlyStats.set(member.id, 0);
            weeklyStats.set(member.id, 0);
        }
        // Calculate the stats
        for (const review of data) {
            const monthlyCount = (_a = monthlyStats.get(review.reviewer)) !== null && _a !== void 0 ? _a : 0;
            monthlyStats.set(review.reviewer, monthlyCount + 1);
            // Check review.submittedAt is within the last week
            const submittedAt = new Date(review.submittedAt);
            const now = new Date();
            const diff = now.getTime() - submittedAt.getTime();
            const diffDays = diff / (1000 * 3600 * 24);
            if (diffDays < 7) {
                const weeklyCount = (_b = weeklyStats.get(review.reviewer)) !== null && _b !== void 0 ? _b : 0;
                weeklyStats.set(review.reviewer, weeklyCount + 1);
            }
        }
        // Get the bottom 20% of reviewers for the week and months
        const monthlyBottom20 = await this.getBottomPercent(monthlyStats, 0.2);
        const weeklyBottom20 = await this.getBottomPercent(weeklyStats, 0.2);
        // Filter the bottom to just bottom reviewers who are bottom reviewers for the week and the month
        const bottomReviewers = new Set([...monthlyBottom20.keys()].filter((x) => weeklyBottom20.has(x)));
        const bottomReviewerStats = [];
        for (const reviewer of bottomReviewers) {
            bottomReviewerStats.push({
                reviewer,
                monthlyCount: (_c = monthlyStats.get(reviewer)) !== null && _c !== void 0 ? _c : 0,
                weeklyCount: (_d = weeklyStats.get(reviewer)) !== null && _d !== void 0 ? _d : 0,
            });
        }
        // Print average number reviews completed this month and this week
        const totalMonthlyReviews = [...monthlyStats.values()].reduce((p, c) => p + c, 0);
        const totalWeeklyReviews = [...weeklyStats.values()].reduce((p, c) => p + c, 0);
        const monthlyAvg = totalMonthlyReviews / monthlyStats.size;
        const weeklyAvg = totalWeeklyReviews / weeklyStats.size;
        console.log(`Average number of reviews per person completed this month: ${monthlyAvg} out of ${totalMonthlyReviews} total reviews.`);
        console.log(`Average number of reviews per person completed this week: ${weeklyAvg} out of ${totalWeeklyReviews} total reviews.`);
        // Calculate top reviewer stats
        const weeklySorted = Array.from(weeklyStats).sort((a, b) => b[1] - a[1]);
        const topReviewerStats = [];
        for (let i = 0; i < 3; i++) {
            const reviewer = weeklySorted[i][0];
            topReviewerStats.push({
                reviewer,
                monthlyCount: (_e = monthlyStats.get(reviewer)) !== null && _e !== void 0 ? _e : 0,
                weeklyCount: (_f = weeklyStats.get(reviewer)) !== null && _f !== void 0 ? _f : 0,
                place: i === 0 ? 'first' : i === 1 ? 'second' : 'third',
            });
        }
        return {
            topReviewers: topReviewerStats,
            bottomReviewers: bottomReviewerStats,
        };
    }
    /**
     * Sends a slack DM to the given user
     * @param userEmail The email of the user to get the slack handle for
     * @param preview The preview message that shows in the mobile notifcation. If no blocks provided, the preview is the message
     * @param blocks The blocks which construct the rich message
     * @param timestampToSend An otpional timestamp to schedule the message for
     */
    async sendSlackDM(slackId, preview, blocks, timestampToSend, skipCooldown) {
        var _a;
        // If user isn't populated and we didn't return early in the error handler, return now
        if (!slackId) {
            return;
        }
        // Get id of conversation with user
        const conversation = (_a = (await this.slackClient.conversations.list({
            types: 'im',
            limit: 100,
        })).channels) === null || _a === void 0 ? void 0 : _a.find((c) => c.user === slackId);
        // If we have an existing conversation with that user then make sure we're not spamming them
        if (conversation && conversation.id) {
            // Get last message in DM from user and ensure it's been at least 10 days
            const history = await this.slackClient.conversations.history({
                channel: conversation.id,
                limit: 1,
            });
            const lastMessage = history.messages ? history.messages[0] : undefined;
            if (lastMessage && lastMessage.ts) {
                const lastMessageDate = new Date(parseInt(lastMessage.ts) * 1000);
                const tenDaysAgo = new Date();
                tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
                if (lastMessageDate > tenDaysAgo && !skipCooldown) {
                    console.log(`Skipping DM as last message was ${lastMessageDate}`);
                    return;
                }
            }
        }
        if (timestampToSend) {
            await this.slackClient.chat.scheduleMessage({
                channel: slackId,
                post_at: timestampToSend,
                text: preview,
                blocks,
            });
        }
        else {
            // Send DM to user
            await this.slackClient.chat.postMessage({
                channel: slackId,
                text: preview,
                blocks,
            });
        }
    }
    /**
     * The main function executed when the action is triggered
     */
    async run() {
        var _a;
        console.time('Review Reminder Action');
        const accounts = await this.toolsAPI.getTeamMembers();
        // Mapping of GitHub accounts to entry in blob storage
        const teamMembers = new Map();
        for (const account of accounts) {
            // Don't include the high level managers and non devs. Eventually we will have nice API to skip them
            if (account.id === 'gregvanl' ||
                account.id === 'chrisdias' ||
                account.id === 'egamma' ||
                account.id === 'kieferrm') {
                continue;
            }
            teamMembers.set(account.id, account);
        }
        const stats = await this.processAllRepositories(teamMembers);
        console.log(stats.bottomReviewers.length);
        // Send DM to top reviewers
        for (const reviewer of stats.topReviewers) {
            const account = teamMembers.get(reviewer.reviewer);
            if (!account) {
                console.log(`Could not find account this is definitely a bug!`);
                continue;
            }
            if (!account.slack) {
                (0, utils_1.safeLog)(`No slack account for ${account.id}`);
                continue;
            }
            await this.sendSlackDM(account.slack, 'Top Reviewer!', ReviewReminder.topReviewerMessage(reviewer.weeklyCount, reviewer.monthlyCount, (_a = reviewer.place) !== null && _a !== void 0 ? _a : 'third'), undefined, true);
        }
        for (const reviewer of stats.bottomReviewers) {
            const account = teamMembers.get(reviewer.reviewer);
            if (!account) {
                (0, utils_1.safeLog)(`Could not find account this is definitely a bug!`);
                continue;
            }
            if (!account.slack) {
                (0, utils_1.safeLog)(`No slack account for ${account.id}`);
                continue;
            }
            // Generate a random unix timestamp in the next 4 hours
            const timestampToSend = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 14400);
            await this.sendSlackDM(account.slack, 'Review Reminder!', ReviewReminder.reviewWarningMessage(reviewer.weeklyCount, stats.topReviewers[0].weeklyCount), timestampToSend);
        }
        console.timeEnd('Review Reminder Action');
    }
}
exports.ReviewReminder = ReviewReminder;
//# sourceMappingURL=ReviewReminder.js.map