# VS Code's Issue Traige GitHub Actions

We here host our [GitHub Actions](https://help.github.com/en/actions) for triaging issues.

Many of these are not specific to VS Code, and can be used in other projects by importing the repository like so:

```yml
steps:
  - name: Checkout Actions
    uses: actions/checkout@v2
    with:
      repository: 'JacksonKearl/vscode-triage-github-actions'
			ref: master # not recommeneded, use the lastest released tag to ensure stability
	- name: Install Actions
		run: npm install --production
  - name: Run Commands
    uses: ./commands
```

Additionally, in `./api`, we have a wrapper around the Octokit instance that can be helpful for developing (and testing!) your own Actions.

*Note:* All Actions must be compiled/packaged into a single output file for deployment. We use [ncc](https://github.com/zeit/ncc) and [husky](https://github.com/typicode/husky) to do this on-commit. Thus committing can take quite a while. If you're making a simple change to non-code files or tests, this can be skipped with the `--no-verify` `git commit` flag.

### Code Layout

The `api` directory contains `api.ts`, which provides an interface for inteacting with github issues. This is implemented both by `octokit.ts` and `testbed.ts`. Octokit will talk to github, testbed mimics GitHub locally, to help with writing unit tests.

The `utils` directory contains various commands to help with interacting with GitHub/other services, which do not have a corresponding mocked version. Thus when using these in code that will be unit tested, it is a good idea to manually mock the calls, using `nock` or similar.

The rest of the directories contain three files:
- `index.ts`: This file is the entry point for actions. It should be the only file in the directory to use Action-specific code, such as any imports from `@actions/`. In most cases it should simply gatehr any required config data, create an `octokit` instance (see `api` section above) and invoke the command. By keeping Action specific code seprate from the rest of the logic, it is easy to extend these commands to run via Apps, or even via webhooks to Azure Funtions or similar.
- `Command.ts`: This file contains the core logic for the command. The commands should operate on the Github interface in `api`, so that they may be run against either GitHub proper or the Testbed.
- `Command.test.ts`: This file contains tests for the command. Tests should invoke the command using a `Testbed` instance, and preferably verify the command works by querying through the `Github` interface, though there are some convenience commands implemened directly on `Testbed` for ease of testing.

## Action Descriptions

### Author Verified
Allow issue authors to verify their own issues by pinging them when the fix goes into insiders

```yml
inputs:
  token:
    description: GitHub token with issue, comment, and label read/write permissions
    default: ${{ github.token }}
  requestVerificationComment:
    description: Comment to add whenn asking authors to verify the issue. ${commit} and ${author} will be substituted
    required: true
  pendingReleaseLabel:
    description: Label for Action to add for issue that authors can verify, but are not yet released
    required: true
  authorVerificationRequestedLabel:
    description: Label added by issue fixer to signal that the author can verify the issue
    required: true
```

### Commands
Respond to commands given in the form of either labels or comments by select groups of people.

This takes as input a `config-path`, which is the `config` part of a `./github/config.json` file in the host repo that describes the commands. This config file should have type:

```ts
export type Command =
	{ name: string } &
	({ type: 'comment' & allowUsers: (username | '@author')[] } | { type: 'label' }) &
	{ action?: 'close' } &
	{ comment?: string; addLabel?: string; removeLabel?: string } &
	{ requireLabel?: string; disallowLabel?: string }
```

```yml
inputs:
  token:
    description: GitHub token with issue, comment, and label read/write permissions
    default: ${{ github.token }}
  config-path:
    description: Name of .json file (no extension) in .github/ directory of repo holding configuration for this action
    required: true
```

### Copycat
Clone all new issues in a repo to a different repo. Useful for testing.

```yml
inputs:
  token:
    description: GitHub token with issue, comment, and label read/write permissions to both repos
    default: ${{ github.token }}
  owner:
    description: account/organization that owns the destination repo (the microsoft part of microsoft/vscode)
    required: true
  repo:
    description: name of the destination repo (the vscode part of microsoft/vscode)
    required: true
```

### Echoer
Action that simply logs the `context` it recieves. Useful for testing.

No input.

### Feature Request
Manage feature requests according to the VS Code [feature request specification](https://github.com/microsoft/vscode/wiki/Issues-Triaging#managing-feature-requests)
```yml
inputs:
  token:
    description: GitHub token with issue, milestone, comment, and label read/write permissions
    default: ${{ github.token }}
  candidateMilestoneID:
    description: Numeric ID of the candidate issues milestone
    required: true
  candidateMilestoneName:
    description: Name of the candidate issues milestone
    required: true
  backlogMilestoneID:
    description: Numeric ID of the backlog milestone
    required: true
  featureRequestLabel:
    description: Label for feature requests
    required: true
  upvotesRequired:
    description: Number of upvotes required to advance an issue
    required: true
  numCommentsOverride:
    description: Number of comments required to disable automatically closing an issue
    required: true
  initComment:
    description: Comment when an issue is introduced to the backlog milestone
    required: true
  warnComment:
    description: Comment when an issue is nearing automatic closure
    required: true
  acceptComment:
    description: Comment when an issue is accepted into backlog
    required: true
  rejectComment:
    description: Comment when an issue is rejected
    required: true
  warnDays:
    description: Number of days before closing the issue to warn about it's impending closure
    required: true
  closeDays:
    description: Number of days to wait before closing an issue
    required: true
  milestoneDelaySeconds:
    description: Delay between adding a feature request label and assigning the issue to candidate milestone
    required: true
```

### Locker
Lock issues and prs that have been closed and not updated for some time.

```yml
inputs:
  token:
    description: GitHub token with issue, comment, and label read/write permissions
    default: ${{ github.token }}
  daysSinceClose:
    description: Days to wait since closing before locking the item
    required: true
  daysSinceUpdate:
    description: days to wait since the last interaction before locking the item
    required: true
  ignoredLabel:
    description: items with this label will not be automatically locked
```

### Needs More Info Closer
Close issues that are marked a needs more info label and were last interacted with by a contributor or bot, after some time has passed.

Can aslo ping the assignee if the last comment was by someonne other than a team member or bot.

```yml
inputs:
  token:
    description: GitHub token with issue, comment, and label read/write permissions
    default: ${{ github.token }}
  label:
    description: Label signifying an issue that needs more info
    required: true
  closeDays:
    description: Days to wait before closing the issue
    required: true
  closeComment:
    description: Comment to add upon closing the issue
  pingDays:
    description: Days to wait before pinging the assignee
    required: true
  pingComment:
    description: Comment to add whenn pinging assignee. ${assignee} and ${author} are replaced.
```

### New Release
Label issues with a version tag matching the latest vscode release, creating the label if it does not exist. Delete the label (thereby unassigning all issues) when the latest release has been out for some time

```yml
inputs:
  token:
    description: GitHub token with issue, comment, and label read/write permissions
    default: ${{ github.token }}
  days:
    description: time ago for releases to count as new releases
    required: true
  label:
    description: name of label to apply
    required: true
  labelColor:
    description: color of label to apply
    required: true
  labelDescription:
    description: description of label to apply
    required: true
```

### Queryer
Runs a query based on the comment given, logging the results. Useful for testing.

```yml
inputs:
  token:
    description: GitHub token with issue, comment, and label read/write permissions
    default: ${{ github.token }}
```

### Test Plan Item Validator
Tag testplan item issues that don't match the VS Code test plan item format
```yml
inputs:
  token:
    description: 'GitHub token with issue, comment, and label read/write permissions'
    default: ${{ github.token }}
  label:
    description: The label that signifies an item is a testplan item and should be checked
    required: true
  invalidLabel:
    description: The label to add when a test plan item is invalid
    required: true
  comment:
    description: Comment to post to invalid test plan items
    required: true
```

## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
