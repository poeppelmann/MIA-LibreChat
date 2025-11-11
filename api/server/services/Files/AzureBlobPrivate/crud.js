const fs = require('fs');
const path = require('path');
const mime = require('mime');
const axios = require('axios');
const fetch = require('node-fetch');
const { BlobServiceClient } = require('@azure/storage-blob');
const { WorkloadIdentityCredential } = require('@azure/identity');
const { logger } = require('~/config');

const defaultBasePath = 'images';
const { 
  AZURE_PRIVATE_STORAGE_ACCOUNT_NAME,
  AZURE_PRIVATE_CONTAINER_NAME = 'files',
} = process.env;

// single instance of the blob service client and container client (= singleton)
let blobServiceClient = null;
let containerClient = null;

/**
 * Initializes the Azure Blob Service client for private storage using Workload Identity.
 * This implementation ONLY uses WorkloadIdentityCredential for AKS production environments.
 */
const initializeAzureBlobPrivateService = () => {
  if (blobServiceClient) {
    return blobServiceClient;
  }

  if (!AZURE_PRIVATE_STORAGE_ACCOUNT_NAME || !AZURE_PRIVATE_CONTAINER_NAME) {
    throw new Error('Azure Blob Private: Missing required configuration. Provide AZURE_PRIVATE_STORAGE_ACCOUNT_NAME and AZURE_PRIVATE_CONTAINER_NAME');
  }

  const url = `https://${AZURE_PRIVATE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`;
  
  try {
    // Use WorkloadIdentityCredential for AKS production environment
    const credential = new WorkloadIdentityCredential();
    blobServiceClient = new BlobServiceClient(url, credential);
    logger.info('Azure Blob Private Service initialized using WorkloadIdentityCredential');
  } catch (error) {
    logger.error('Failed to initialize with WorkloadIdentityCredential:', error);
    throw new Error('Azure Blob Private: Failed to initialize with WorkloadIdentityCredential. Ensure the pod has proper Workload Identity permissions and is running in AKS with Workload Identity enabled.');
  }

  containerClient = blobServiceClient.getContainerClient(AZURE_PRIVATE_CONTAINER_NAME);
  return blobServiceClient;
};



/**
 * Gets the direct Azure Blob Storage URL for a private blob.
 * @param {string} blobName - The blob name.
 * @param {string} containerName - The container name.
 * @returns {string} The direct Azure Blob Storage URL.
 */
function getDirectBlobUrl(blobName, containerName) {
  // Return the direct Azure Blob Storage URL
  return `https://${AZURE_PRIVATE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${containerName}/${blobName}`;
}



/**
 * Uploads a buffer directly to Azure Blob Storage using Managed Identity.
 * @param {string} blobName - The blob name.
 * @param {Buffer} buffer - The buffer to upload.
 * @param {string} contentType - The content type.
 * @returns {Promise<void>}
 */
async function uploadBufferDirectly(blobName, buffer, contentType = 'application/octet-stream') {
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.upload(buffer, buffer.length, {
    blobHTTPHeaders: {
      blobContentType: contentType
    }
  });
}

/**
 * Uploads a file directly to Azure Blob Storage using Managed Identity.
 * @param {string} blobName - The blob name.
 * @param {string} filePath - The local file path.
 * @returns {Promise<void>}
 */
async function uploadFileDirectly(blobName, filePath) {
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  const contentType = mime.getType(filePath) || 'application/octet-stream';
  
  await blockBlobClient.uploadFile(filePath, {
    blobHTTPHeaders: {
      blobContentType: contentType
    }
  });
}

/**
 * Uploads a buffer to Azure Blob Private Storage using Workload Identity.
 * @param {Object} params
 * @param {string} params.userId - The user's id.
 * @param {Buffer} params.buffer - The buffer to upload.
 * @param {string} params.fileName - The name of the file.
 * @param {string} [params.basePath='images'] - The base folder within the container.
 * @param {string} [params.containerName] - The Azure Blob container name.
 * @returns {Promise<string>} The direct Azure Blob Storage URL of the uploaded blob.
 */
async function saveBufferToAzureBlobPrivate({
  userId,
  buffer,
  fileName,
  basePath = defaultBasePath,
  containerName = AZURE_PRIVATE_CONTAINER_NAME,
}) {
  try {
    initializeAzureBlobPrivateService();
    
    // Create the container if it doesn't exist (private access)
    await containerClient.createIfNotExists();
    
    const blobPath = `${basePath}/${userId}/${fileName}`;
    const contentType = mime.getType(fileName) || 'application/octet-stream';
    
    // Upload buffer using Workload Identity
    await uploadBufferDirectly(blobPath, buffer, contentType);
    
    // Return direct Azure Blob Storage URL
    return getDirectBlobUrl(blobPath, containerName);
  } catch (error) {
    logger.error('[saveBufferToAzureBlobPrivate] Error uploading buffer:', error);
    throw error;
  }
}

/**
 * Saves a file from a URL to Azure Blob Private Storage.
 * @param {Object} params
 * @param {string} params.userId - The user's id.
 * @param {string} params.URL - The URL of the file.
 * @param {string} params.fileName - The name of the file.
 * @param {string} [params.basePath='images'] - The base folder within the container.
 * @param {string} [params.containerName] - The Azure Blob container name.
 * @returns {Promise<string>} The signed download URL of the uploaded blob.
 */
async function saveURLToAzureBlobPrivate({
  userId,
  URL,
  fileName,
  basePath = defaultBasePath,
  containerName = AZURE_PRIVATE_CONTAINER_NAME,
}) {
  try {
    const response = await fetch(URL);
    const buffer = await response.buffer();
    return await saveBufferToAzureBlobPrivate({ userId, buffer, fileName, basePath, containerName });
  } catch (error) {
    logger.error('[saveURLToAzureBlobPrivate] Error uploading file from URL:', error);
    throw error;
  }
}

/**
 * Retrieves a download URL from Azure Blob Private Storage.
 * @param {Object} params
 * @param {string} params.fileName - The file name.
 * @param {string} [params.basePath='images'] - The base folder used during upload.
 * @param {string} [params.userId] - If files are stored in a user-specific directory.
 * @param {string} [params.containerName] - The Azure Blob container name.
 * @returns {Promise<string>} The direct Azure Blob Storage URL.
 */
async function getAzureBlobPrivateURL({ 
  fileName, 
  basePath = defaultBasePath, 
  userId, 
  containerName = AZURE_PRIVATE_CONTAINER_NAME 
}) {
  try {
    initializeAzureBlobPrivateService();
    const blobPath = userId ? `${basePath}/${userId}/${fileName}` : `${basePath}/${fileName}`;
    
    return getDirectBlobUrl(blobPath, containerName);
  } catch (error) {
    logger.error('[getAzureBlobPrivateURL] Error retrieving URL:', error);
    throw error;
  }
}

/**
 * Deletes a blob from Azure Blob Private Storage.
 * @param {Object} params
 * @param {ServerRequest} params.req - The Express request object.
 * @param {MongoFile} params.file - The file object.
 */
async function deleteFileFromAzureBlobPrivate(req, file) {
  try {
    initializeAzureBlobPrivateService();
    
    // Extract blob path from filepath
    const blobPath = file.filepath.split(`${AZURE_PRIVATE_CONTAINER_NAME}/`)[1];
    if (!blobPath.includes(req.user.id)) {
      throw new Error('User ID not found in blob path');
    }
    
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
    await blockBlobClient.delete();
    logger.debug('[deleteFileFromAzureBlobPrivate] Blob deleted successfully from Azure Blob Private Storage');
  } catch (error) {
    logger.error('[deleteFileFromAzureBlobPrivate] Error deleting blob:', error);
    if (error.statusCode === 404) {
      return;
    }
    throw error;
  }
}

/**
 * Uploads a file from the local file system to Azure Blob Private Storage using Workload Identity.
 * @param {Object} params
 * @param {object} params.req - The Express request object.
 * @param {Express.Multer.File} params.file - The file object.
 * @param {string} params.file_id - The file id.
 * @param {string} [params.basePath='images'] - The base folder within the container.
 * @param {string} [params.containerName] - The Azure Blob container name.
 * @returns {Promise<{ filepath: string, bytes: number }>} An object containing the direct Azure Blob Storage URL and its byte size.
 */
async function uploadFileToAzureBlobPrivate({
  req,
  file,
  file_id,
  basePath = defaultBasePath,
  containerName = AZURE_PRIVATE_CONTAINER_NAME,
}) {
  try {
    initializeAzureBlobPrivateService();
    
    const inputFilePath = file.path;
    const stats = await fs.promises.stat(inputFilePath);
    const bytes = stats.size;
    const userId = req.user.id;
    const fileName = `${file_id}__${path.basename(inputFilePath)}`;
    const blobPath = `${basePath}/${userId}/${fileName}`;
    
    // Create the container if it doesn't exist (private access)
    await containerClient.createIfNotExists();
    
    // Upload file using Workload Identity
    await uploadFileDirectly(blobPath, inputFilePath);
    
    // Generate direct Azure Blob Storage URL for return
    const downloadUrl = getDirectBlobUrl(blobPath, containerName);
    
    return { filepath: downloadUrl, bytes };
  } catch (error) {
    logger.error('[uploadFileToAzureBlobPrivate] Error uploading file:', error);
    throw error;
  }
}

/**
 * Retrieves a readable stream for a blob from Azure Blob Private Storage.
 * @param {object} _req - The Express request object.
 * @param {string} fileURL - The direct Azure Blob Storage URL of the blob.
 * @returns {Promise<ReadableStream>} A readable stream of the blob.
 */
async function getAzureBlobPrivateFileStream(_req, fileURL) {
  try {
    // Extract blob name from the Azure Blob Storage URL
    const blobName = AZURE_PRIVATE_CONTAINER_NAME;
    
    // Use direct blob client with Workload Identity
    const blobClient = containerClient.getBlobClient(blobName);
    const downloadResponse = await blobClient.download();
    return downloadResponse.readableStreamBody;
  } catch (error) {
    logger.error('[getAzureBlobPrivateFileStream] Error getting blob stream:', error);
    throw error;
  }
}

module.exports = {
  saveBufferToAzureBlobPrivate,
  saveURLToAzureBlobPrivate,
  getAzureBlobPrivateURL,
  deleteFileFromAzureBlobPrivate,
  uploadFileToAzureBlobPrivate,
  getAzureBlobPrivateFileStream,
  uploadBufferDirectly,
  uploadFileDirectly,
};
