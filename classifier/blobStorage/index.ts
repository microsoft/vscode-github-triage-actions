/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { join } from 'path';
import { BlobServiceClient } from '@azure/storage-blob';
import { Readable } from 'stream';

export async function downloadBlobFile(name: string, container: string, key: string) {
	const blobServiceClient = BlobServiceClient.fromConnectionString(key);
	const containerClient = blobServiceClient.getContainerClient(container);

	const createContainerResponse = containerClient.getBlockBlobClient(name);
	await createContainerResponse.downloadToFile(join(__dirname, name));
}

export async function uploadBlobFile(name: string, container: string, key: string) {
	const blobServiceClient = BlobServiceClient.fromConnectionString(key);
	const containerClient = blobServiceClient.getContainerClient(container);

	const createContainerResponse = containerClient.getBlockBlobClient(name);

	await createContainerResponse.uploadFile(join(__dirname, name));
}

export async function uploadBlobText(name: string, text: string, container: string, key: string) {
	const blobServiceClient = BlobServiceClient.fromConnectionString(key);
	const containerClient = blobServiceClient.getContainerClient(container);

	const createContainerResponse = containerClient.getBlockBlobClient(name);

	await createContainerResponse.uploadStream(Readable.from([text]));
}

export async function downloadBlobText(name: string, container: string, key: string) {
	const blobServiceClient = BlobServiceClient.fromConnectionString(key);
	const containerClient = blobServiceClient.getContainerClient(container);

	const createContainerResponse = containerClient.getBlockBlobClient(name);
	const buffer = await createContainerResponse.downloadToBuffer();
	return buffer.toString();
}
