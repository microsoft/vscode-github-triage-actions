# Deep Classifier

The deep classifier workflow is comprised of several components:

- Azure Storage Account
    - This is used to store the models and issue data, it is written to in training phase and read from while classifying.
- Training
  - ./train/fetch-issues Action
    - This GitHub Action scrapes issues from the repo and uploads them to issues.json.zip in blob storage.
  - Azure GPU VM
    - A GPU-enabled VM running Ubuntu is needed to train the models. The ./vm-filesystem directory contains the files needed in the VM, these files should be copied over to the VM. The SSH-Remove extension for VS Code can be helpful here.
    - The provision-vm.sh script has been tested to work with NC6s_v2 VM's on Azure.
- Applying
  - ./apply/fetch-sources Action
    - This pulls the recent issues, models and other related data from blob storage and places them on the Action runner's filesystem for
  - ./apply/generaate-labels Action
    - This runs the downloaded models against the recent issues and stores the results on the filesystem
  - ./apply/apply-labels
    - This takes the labelings generated by the generate stage and pushes them to GitHub.

See the microsoft/vscode repo for an example of how to configure these actions.

## One-Time Setup
1) Create an Azure Storage account for storing models, issue data, etc.
1) Run the fetch-issues action to scrape issue data and place it into blob storage. (See [vscode's configuration](https://github.com/microsoft/vscode/blob/master/.github/workflows/deep-classifier-scraper.yml)), which is triggered by a [`repostory_dispatch`](https://docs.github.com/en/actions/configuring-and-managing-workflows/configuring-a-workflow#triggering-workflows-from-external-events) event.
2) Create an GPU-powered Azure VM (tested to work with NC6s_v2 models). Setting an auto-shutoff time is a good idea to prevent accidental cost overruns. The chief expense is actually storage - but this can be dramatically reduced by specifying a 32GB HDD as the OS disk. The 32GB dish leaves room for models, but be sure to reduce the number of "checkpoints" saved to save space.
3) On the VM...
     1) run the provision-vm.sh script to download all drivers/etc
     2) update the run.sh script to use your blob container name
     3) update storage.ts to use your connection string.
     4) update createDataDir.ts to include your desired assignees and labels (labels/assignees not included here will not be trained upon)
     5) run `npx ts-node storage.ts download issues.json.zip vscode-issue-classifier` to get the `issues.json.zip` dump from the `fetch-issues` action above.
     6) decompress the dump (`unzip -j blobs/issues.json.zip`)
     7) run `createFineTunedModel.py` to create the base model. This will take a while.
     8) run the ./run.sh script to generate and upload the models. This will take a while.

## Periodic Re-Training
1) Run the fetch-issues action to scrape issue data and place it into blob storage. (See [vscode's configuration](https://github.com/microsoft/vscode/blob/master/.github/workflows/deep-classifier-scraper.yml)), which is triggered by a [`repostory_dispatch`](https://docs.github.com/en/actions/configuring-and-managing-workflows/configuring-a-workflow#triggering-workflows-from-external-events) event.
2) On the VM, run the ./run.sh script to generate and upload models. This will take a while.
