"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadBlobFile = exports.downloadBlobFile = void 0;
const identity_1 = require("@azure/identity");
const storage_blob_1 = require("@azure/storage-blob");
const path_1 = require("path");
const credential = new identity_1.DefaultAzureCredential();
async function downloadBlobFile(name, container) {
    const blobServiceClient = new storage_blob_1.BlobServiceClient('https://vscodegithubautomation.blob.core.windows.net', credential);
    const containerClient = blobServiceClient.getContainerClient(container);
    const createContainerResponse = containerClient.getBlockBlobClient(name);
    await createContainerResponse.downloadToFile((0, path_1.join)(__dirname, name));
}
exports.downloadBlobFile = downloadBlobFile;
async function uploadBlobFile(name, container) {
    const blobServiceClient = new storage_blob_1.BlobServiceClient('https://vscodegithubautomation.blob.core.windows.net', credential);
    const containerClient = blobServiceClient.getContainerClient(container);
    const createContainerResponse = containerClient.getBlockBlobClient(name);
    await createContainerResponse.uploadFile((0, path_1.join)(__dirname, name));
}
exports.uploadBlobFile = uploadBlobFile;
//# sourceMappingURL=index.js.map