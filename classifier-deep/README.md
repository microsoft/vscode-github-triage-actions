# Deep Classifier

The deep classifier workflow is comprised of many parts:

- Shared
  - Azure Storage account
    - This is used to store the models and issue data
- Training
  - ./train/fetch-issues Action
    - This Action scrapes issues from the repo and uploads them to issues.json.zip in blob storage.
  - Azure GPU VM
    - A GPU-enabled VM running Ubuntu is needed to train the models. The ./vm-filesystem directory contains the files needed in the VM.
    - The provision-vm.sh script has been tested to work with NC6s_v2 VM's on Azure.
- Applying
  - ./apply/fetch-sources Action
    - This pulls the recent issues, models and other related daata from blob storage and places them on the Action runner's filesystem for
  - ./apply/generaate-labels Action
    - This runs the downloaaded models against the recent issues and stores the results on the filesystem
  - ./apply/apply-labels
    - This takes the laabelings geneeated by the generate stage and pushes them to GitHub.
