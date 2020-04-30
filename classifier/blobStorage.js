"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const storage_blob_1 = require("@azure/storage-blob");
async function downloadBlob(name, container, key) {
    const blobServiceClient = storage_blob_1.BlobServiceClient.fromConnectionString(key);
    const containerClient = blobServiceClient.getContainerClient(container);
    const createContainerResponse = containerClient.getBlockBlobClient(name);
    await createContainerResponse.downloadToFile(path_1.join(__dirname, name));
}
exports.downloadBlob = downloadBlob;
async function uploadBlob(name, container, key) {
    const blobServiceClient = storage_blob_1.BlobServiceClient.fromConnectionString(key);
    const containerClient = blobServiceClient.getContainerClient(container);
    const createContainerResponse = containerClient.getBlockBlobClient(name);
    await createContainerResponse.uploadFile(path_1.join(__dirname, name));
}
exports.uploadBlob = uploadBlob;
//# sourceMappingURL=blobStorage.js.map