#! /bin/bash

set -e

echo 'Cleaning up prior data'
rm -f blobs/*.zip
rm -f issues.json

echo 'Getting latest issues dump'
npx ts-node storage.ts download issues.json.zip vscode-issue-classifier
unzip -j blobs/issues.json.zip

echo 'Unpacking issues.json'
npx ts-node createDataDir.ts

echo 'Generating models'
python generateModels.py

echo 'Destroying checkpoints'
rm -rf area_model/checkpoint*
rm -rf assignee_model/checkpoint*

echo 'Generating threshold configurations'
python generateConfigurations.py

echo 'Packaging models'
cd assignee_model
zip -r ../blobs/assignee_model.zip .
cd ..

cd area_model
zip -r ../blobs/area_model.zip .
cd ..

echo 'Uploading models'
npx ts-node storage.ts upload assignee_model.zip vscode-issue-classifier
npx ts-node storage.ts upload area_model.zip vscode-issue-classifier
