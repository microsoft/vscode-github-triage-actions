#! /bin/bash

set -e

mkdir blobs

conda activate transformers

echo 'Getting latest issues dump'
npx ts-node storage.ts download issues.json.zip BLOB_CONTAINER_NAME
unzip blobs/issues.json.zip issues.json


echo 'Generating models'
python generateModels.py

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
npx ts-node storage.ts upload assignee_model.zip BLOB_CONTAINER_NAME
npx ts-node storage.ts upload area_model.zip BLOB_CONTAINER_NAME
