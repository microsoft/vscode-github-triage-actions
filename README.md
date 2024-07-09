# VS Code's Issue Triage GitHub Actions

We host our [GitHub Actions](https://help.github.com/en/actions) for triaging issues here.

Many of these are not specific to VS Code, and can be used in other projects by importing the repository like so:

```yml
steps:
  - name: Checkout Actions
    uses: actions/checkout@v2
    with:
      repository: 'microsoft/vscode-triage-github-actions'
      ref: stable # not recommeneded, use the lastest released tag to ensure stability
  - name: Install Actions
    run: npm install --production
  - name: Run Commands
    uses: ./commands
```

Additionally, in `./api`, we have a wrapper around the Octokit instance that can be helpful for developing (and testing!) your own Actions.

*Note:* All Actions must be compiled/packaged into a single output file for deployment. We use [ncc](https://github.com/zeit/ncc) and [husky](https://github.com/typicode/husky) to do this on-commit. Thus committing can take quite a while. If you're making a simple change to non-code files or tests, this can be skipped with the `--no-verify` `git commit` flag.

### Code Layout

The `api` directory contains `api.ts`, which provides an interface for interacting with GitHub issues. This is implemented both by `octokit.ts` and `testbed.ts`. Octokit will talk to GitHub, testbed mimics GitHub locally, to help with writing unit tests.

The `utils` directory contains various commands to help with interacting with GitHub/other services, which do not have a corresponding mocked version. Thus when using these in code that will be unit tested, it is a good idea to manually mock the calls, using `nock` or similar.

The rest of the directories contain three files:
- `index.ts`: This file is the entry point for actions. It should be the only file in the directory to use Action-specific code, such as any imports from `@actions/`. In most cases it should simply gather any required config data, create an `octokit` instance (see `api` section above) and invoke the command. By keeping Action specific code separate from the rest of the logic, it is easy to extend these commands to run via Apps, or even via webhooks to Azure Functions or similar.
- `Command.ts`: This file contains the core logic for the command. The commands should operate on the GitHub interface in `api`, so that they may be run against either GitHub proper or the Testbed.
- `Command.test.ts`: This file contains tests for the command. Tests should invoke the command using a `Testbed` instance, and preferably verify the command works by querying through the `GitHub` interface, though there are some convenience commands implemented directly on `Testbed` for ease of testing.
- `cpi.ts`: This is not present in every directory, but when present allows for running the action via command line, by running `node action/cli.js` with appropriate flags.

## Action Descriptions

### Author Verified
Allow issue authors to verify their own issues by pinging them when the fix goes into insiders

```yml
inputs:
  token:
    description: GitHub token with issue, comment, and label read/write permissions
    default: ${{ github.token }}
  requestVerificationComment:
    description: Comment to add when asking authors to verify the issue. ${commit} and ${author} will be substituted
    required: true
  releasedLabel:
    description: Label of issues which are released and thus able to be verified
    required: true
  verifiedLabel:
    description: Label of issues that are already verified and shouldn't be further interacted with
    required: true
  authorVerificationRequestedLabel:
    description: Label added by issue fixer to signal that the author can verify the issue
    required: true
```

### Deep Classifier

This classifier generates assignees and labels using a deep-learning model stored in Azure Blob storage and generated using an Azure GPU instance. The model is created with help from [simpletransformers](https://simpletransformers.ai/) and [huggingface/transformers](https://github.com/huggingface/transformers).

This setup is more involved and detailed in the [Action's README](/classifier-deep/README.md).

### Classifier

This classifier generates assignees and labels using a model stored in Azure Blob storage and generated using a GitHub Actions runner.

The full classifier workflow is a 2-part process (Train, Apply), with each part consisting of several individual Actions. It may be helpful to see how this is configured in the [vscode-remote-release repository](https://github.com/microsoft/vscode-remote-release/tree/master/.github/workflows).

#### Train

In this part, the full issue data for the repository is downloaded and ML models are applied to it. These models then get uploaded to Azure Storage, to be later consumed by the Labeling part. This action should run periodically (approximately monthly) to keep the models from going stale.

##### fetch-issues
Download all issues and associated labeling data

```yml
inputs:
  token:
    description: GitHub token with issue, comment, and label read/write permissions
    default: ${{ github.token }}
  areas:
    description: Pipe-separated list of feature-areas to classify
  assignees:
    description: Pipe-separated list of assignees to classify
```

##### generate-models
This is a Python Action, invoked like:

```yml
run: python ./actions/classifier/train/generate-models/generate.py category
```

##### upload-models
Upload models to blob storage

```yml
inputs:
  token:
    description: GitHub token with issue, comment, and label read/write permissions
    default: ${{ github.token }}
  blobContainerName:
    description: Name of Azure Storage container
    required: true
```

#### Apply

In this part, the models generated in the Training phase get applied to issues. To save on bandwidth and compute, this is done in batches. For example, every half hour, the issues in the past period are passed through the models and assigned a label.

##### fetch-issues
Collect the issues which need to be labeled and write them to a file for later processing

```yml
inputs:
  token:
    description: GitHub token with issue, comment, and label read/write permissions
    default: ${{ github.token }}
  from:
    description: Start point of collected issues (minutes ago)
    required: true
  until:
    description: End point of collected issues (minutes ago)
    required: true
  blobContainerName:
    description: Name of Azure Storage container
    required: true
```

##### generate-labels
This is a Python Action, invoked like:

```yml
run: python ./actions/classifier/apply/generate-labels/main.py
```

##### apply-labels
Applies labels generated from the python script back to their respective issues

```yml
inputs:
  token:
    description: GitHub token with issue, comment, and label read/write permissions
    default: ${{ github.token }}
  config-path:
    description: The PATH of a .github/PATH.json in the repo that describes what should be done per feature area
    required: true
  allowLabels:
    description: "Pipe (|) separated list of labels such that the bot should act even if those labels are already present (use for bot-applied labels/etc.)"
    default: ''
```

#### Monitor

This action monitors `unassign` events and reports them back to app insights for analysis.

```yaml
inputs:
  token:
    description: GitHub token with issue, comment, and label read/write permissions
    default: ${{ github.token }}
  botName:
    description: The login of the bot
    required: true
  appInsightsKey:
    description: Key for Azure App Insights to monitor application health
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

Commands of type `comment` and name `label` or `assign` are special-cased to label or assign their arguments:
```
\label bug "needs more info"
\assign JacksonKearl
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

### English Please
Action that identifies issues that are not in English and requests the author to translate them. It additionally labels the issues with a label like `translation-required-russian`, allowing community members to filter for issues they may be able to help translate.

It can also add `needs more info` type labels, to allow the `needs-more-info` action to close non-english issues that do not receive translations after a set time.

Automatic language detection simply checks for non-latin characters. Issues in foreign languages with latin script must be flagged manually, by applying the `nonEnglishLabel`.

In our experience, automatic translation services are unable to effectively translate technical language, so rather than automatically translating the issue, this Action flags the issue as being in a particular language and lea es a comment requesting the original issue author to either translate the issue themselves if they are able to, or wait for a community member to translate.

This Action uses the [Azure Translator Text](https://docs.microsoft.com/en-us/azure/cognitive-services/translator/translator-info-overview) API to identify languages and translate the comment requesting translation to the issue's language.

If you are able to provide a manual translation of the comment, you can help us out by leaving an issue or file a PR against the file `./english-please/translation-data.json`. Thanks!

```yml
inputs:
  token:
    description: GitHub token with issue, comment, and label read/write permissions
    default: ${{ github.token }}
  nonEnglishLabel:
    description: Label to add when issues are not written in English
    required: true
  needsMoreInfoLabel:
    description: Optional label to add for triggering the 'needs more info' bot to close issues that are not translated
  translatorRequestedLabelPrefix:
    description: Labels will be created as needed like "translator-requested-zh" to allow community members to assist in translating issues
    required: true
  translatorRequestedLabelColor:
    description: Labels will be created as needed like "translator-requested-zh" to allow community members to assist in translating issues
    required: true
  cognitiveServicesAPIKey:
    description: API key for the text translator cognitive service to use when detecting issue language and responding to the issue author in their language
    required: true
```

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
  labelsToExclude:
    description: A comma-separated list of labels to exclude from processing
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
  rejectLabel:
    description: Label applied to issues that are rejected
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
Lock issues and/or PRs that have been closed and not updated for some time.

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
  ignoreLabelUntil:
    description: items with this label will not be automatically locked, until they also have the until label
  labelUntil:
    description: items with this will not automatically locked, even if they have the ignoreLabelUntil label
  typeIs:
    description: either 'issue' or 'pr' to limit the query to only those types
```

### Needs More Info Closer
Close issues that are marked a `needs more info` label and were last interacted with by a contributor or bot, after some time has passed.

Can also ping the assignee if the last comment was by someone other than a team member or bot.

```yml
inputs:
  token:
    description: GitHub token with issue, comment, and label read/write permissions
    default: ${{ github.token }}
  label:
    description: Label signifying an issue that needs more info
    required: true
  additionalTeam:
    description: Pipe-separated list of users to treat as team for purposes of closing `needs more info` issues
  closeDays:
    description: Days to wait before closing the issue
    required: true
  closeComment:
    description: Comment to add upon closing the issue
  pingDays:
    description: Days to wait before pinging the assignee
    required: true
  pingComment:
    description: Comment to add when pinging assignee. ${assignee} and ${author} are replaced.
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

### Stale Closer
Closes stale issues that have not had activity or upvotes
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
  featureRequestLabel:
    description: Label for feature requests
    required: true
  upvotesRequired:
    description: Number of upvotes required to advance an issue
    required: true
  numCommentsOverride:
    description: Number of comments required to disable automatically closing an issue
    required: true
  labelsToExclude:
    description: A comma-separated list of labels to exclude from processing
  warnComment:
    description: Comment when an issue is nearing automatic closure
    required: true
  rejectComment:
    description: Comment when an issue is rejected
    required: true
  rejectLabel:
    description: Label applied to issues that are rejected
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

### Topic Subscribe
Subscribe a set of users to an issue when it gets a particular label.

```yml
inputs:
  token:
    description: GitHub token with issue, comment, and label read/write permissions
    default: ${{ github.token }}
  config-path:
    description: Name of .json file (no extension) in .github/ directory of repo holding configuration for this action
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
