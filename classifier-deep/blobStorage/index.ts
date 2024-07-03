/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient } from '@azure/storage-blob';
import { join } from 'path';

const credential = new DefaultAzureCredential();

export async function downloadBlobFile(name: string, container: string) {
	const blobServiceClient = new BlobServiceClient(
		'https://vscodegithubautomation.blob.core.windows.net',
		credential,
	);
	const containerClient = blobServiceClient.getContainerClient(container);

	const createContainerResponse = containerClient.getBlockBlobClient(name);
	await createContainerResponse.downloadToFile(join(__dirname, name));
}

export async function uploadBlobFile(name: string, container: string) {
	const blobServiceClient = new BlobServiceClient(
		'https://vscodegithubautomation.blob.core.windows.net',
		credential,
	);
	const containerClient = blobServiceClient.getContainerClient(container);

	const createContainerResponse = containerClient.getBlockBlobClient(name);

	await createContainerResponse.uploadFile(join(__dirname, name));
}
