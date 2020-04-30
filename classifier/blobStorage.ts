/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { join } from 'path'
import { BlobServiceClient } from '@azure/storage-blob'

export async function downloadBlob(name: string, container: string, key: string) {
	const blobServiceClient = BlobServiceClient.fromConnectionString(key)
	const containerClient = blobServiceClient.getContainerClient(container)

	const createContainerResponse = containerClient.getBlockBlobClient(name)

	await createContainerResponse.downloadToFile(join(__dirname, name))
}

export async function uploadBlob(name: string, container: string, key: string) {
	const blobServiceClient = BlobServiceClient.fromConnectionString(key)
	const containerClient = blobServiceClient.getContainerClient(container)

	const createContainerResponse = containerClient.getBlockBlobClient(name)

	await createContainerResponse.uploadFile(join(__dirname, name))
}
