#! /home/AzureUser/node_modules/.bin/ts-node

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { join } from 'path'
import { BlobServiceClient } from '@azure/storage-blob'

const connectionString = '' // Azure Storage conenction string

export async function downloadBlob(name: string, container: string) {
	const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
	const containerClient = blobServiceClient.getContainerClient(container)

	const createContainerResponse = containerClient.getBlockBlobClient(name)

	await createContainerResponse.downloadToFile(join(__dirname, 'blobs', name))
}

export async function uploadBlob(name: string, container: string) {
	const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
	const containerClient = blobServiceClient.getContainerClient(container)

	const createContainerResponse = containerClient.getBlockBlobClient(name)

	await createContainerResponse.uploadFile(join(__dirname, 'blobs', name))
}

const [_, __, op, name, container] = process.argv

if ((op === 'download' || op === 'upload') && name && container) {
	// eslint-disable-next-line
	;(op === 'download' ? downloadBlob : uploadBlob)(name, container)
}
