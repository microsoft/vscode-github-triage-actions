"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadBlobText = exports.uploadBlobText = exports.uploadBlobFile = exports.downloadBlobFile = void 0;
const path_1 = require("path");
const storage_blob_1 = require("@azure/storage-blob");
const stream_1 = require("stream");
async function downloadBlobFile(name, container, key) {
    const blobServiceClient = storage_blob_1.BlobServiceClient.fromConnectionString(key);
    const containerClient = blobServiceClient.getContainerClient(container);
    const createContainerResponse = containerClient.getBlockBlobClient(name);
    await createContainerResponse.downloadToFile((0, path_1.join)(__dirname, name));
}
exports.downloadBlobFile = downloadBlobFile;
async function uploadBlobFile(name, container, key) {
    const blobServiceClient = storage_blob_1.BlobServiceClient.fromConnectionString(key);
    const containerClient = blobServiceClient.getContainerClient(container);
    const createContainerResponse = containerClient.getBlockBlobClient(name);
    await createContainerResponse.uploadFile((0, path_1.join)(__dirname, name));
}
exports.uploadBlobFile = uploadBlobFile;
async function uploadBlobText(name, text, container, key) {
    const blobServiceClient = storage_blob_1.BlobServiceClient.fromConnectionString(key);
    const containerClient = blobServiceClient.getContainerClient(container);
    const createContainerResponse = containerClient.getBlockBlobClient(name);
    await createContainerResponse.uploadStream(stream_1.Readable.from([text]));
}
exports.uploadBlobText = uploadBlobText;
async function downloadBlobText(name, container, key) {
    const blobServiceClient = storage_blob_1.BlobServiceClient.fromConnectionString(key);
    const containerClient = blobServiceClient.getContainerClient(container);
    const createContainerResponse = containerClient.getBlockBlobClient(name);
    const buffer = await createContainerResponse.downloadToBuffer();
    return buffer.toString();
}
exports.downloadBlobText = downloadBlobText;
//# sourceMappingURL=index.js.map