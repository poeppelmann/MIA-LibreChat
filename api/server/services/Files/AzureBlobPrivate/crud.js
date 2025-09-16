const fs = require('fs');
const path = require('path');
const mime = require('mime');
const axios = require('axios');
const fetch = require('node-fetch');
const { 
  BlobServiceClient, 
  BlobSASPermissions, 
  generateBlobSASQueryParameters, 
  StorageSharedKeyCredential 
} = require('@azure/storage-blob');
const { logger } = require('~/config');

const defaultBasePath = 'images';
const { 
  AZURE_PRIVATE_STORAGE_ACCOUNT_NAME,
  AZURE_PRIVATE_STORAGE_ACCOUNT_KEY,
  AZURE_PRIVATE_CONTAINER_NAME = 'files',
} = process.env;

// single instance of the blob service client and container client (= singleton)
let blobServiceClient = null;
let containerClient = null;

/**
 * Initializes the Azure Blob Service client for private storage with signed URLs.
 */
const initializeAzureBlobPrivateService = () => {
  if (blobServiceClient) {
    return blobServiceClient;
  }

  if (AZURE_PRIVATE_STORAGE_ACCOUNT_NAME && AZURE_PRIVATE_STORAGE_ACCOUNT_KEY && AZURE_PRIVATE_CONTAINER_NAME) {
    const url = `https://${AZURE_PRIVATE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`;
    const credential = new StorageSharedKeyCredential(AZURE_PRIVATE_STORAGE_ACCOUNT_NAME, AZURE_PRIVATE_STORAGE_ACCOUNT_KEY);
    blobServiceClient = new BlobServiceClient(url, credential);
  } else {
    throw new Error('Azure Blob Private: Missing required configuration. Provide AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY and AZURE_PRIVATE_CONTAINER_NAME');
  }

  containerClient = blobServiceClient.getContainerClient(AZURE_PRIVATE_CONTAINER_NAME);
  logger.info('Azure Blob Private Service initialized');
  return blobServiceClient;
};

/**
 * Creates a SAS read string for private blob access.
 * @param {string} key - The Azure storage account key.
 * @param {string} accountName - The Azure storage account name.
 * @param {string} containerName - The container name.
 * @param {number} duration - Duration in minutes (default: 5) after which the SAS URL will expire.
 * @returns {string} The SAS query parameters.
 */
function createSASReadString(key, accountName, containerName, duration = 5) {
  const permissions = new BlobSASPermissions();
  permissions.read = true;

  const currentDateTime = new Date();
  const expiryDateTime = new Date(currentDateTime.setMinutes(currentDateTime.getMinutes() + duration));
  
  const blobSasModel = {
    containerName,
    permissions,
    expiresOn: expiryDateTime
  };

  const credential = new StorageSharedKeyCredential(accountName, key);
  return generateBlobSASQueryParameters(blobSasModel, credential);
}

/**
 * Creates a SAS write string for private blob upload.
 * @param {string} blobName - The blob name.
 * @param {string} key - The Azure storage account key.
 * @param {string} accountName - The Azure storage account name.
 * @param {string} containerName - The container name.
 * @param {number} duration - Duration in minutes (default: 5) after which the SAS URL will expire.
 * @returns {string} The SAS URL for upload.
 */
async function createSASWriteString(blobName, key, accountName, containerName, duration = 5) {
  const permissions = new BlobSASPermissions();
  permissions.write = true;

  const currentDateTime = new Date();
  const expiryDateTime = new Date(currentDateTime.setMinutes(currentDateTime.getMinutes() + duration));
  
  const blobSasModel = {
    containerName,
    permissions,
    expiresOn: expiryDateTime
  };

  const credential = new StorageSharedKeyCredential(accountName, key);
  const sasQueryParams = generateBlobSASQueryParameters(blobSasModel, credential);
  
  const tempBlockBlobClient = containerClient.getBlockBlobClient(blobName);
  return `${tempBlockBlobClient.url}?${sasQueryParams}`;
}

/**
 * Gets a signed download URL for a private blob.
 * @param {string} blobName - The blob name.
 * @param {string} key - The Azure storage account key.
 * @param {string} accountName - The Azure storage account name.
 * @param {string} containerName - The container name.
 * @param {number} duration - Duration in minutes (default: 5).
 * @returns {string} The signed download URL.
 */
function getSignedDownloadUrl(blobName, key, accountName, containerName, duration = 5) {
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  const sasQueryParams = createSASReadString(key, accountName, containerName, duration);
  return `${blockBlobClient.url}?${sasQueryParams}`;
}

/**
 * Uploads a file directly to Azure Blob Storage using signed URL.
 * @param {string} url - The signed upload URL.
 * @param {string} filePath - The local file path.
 * @returns {Promise<void>}
 */
async function uploadFileToSignedUrl(url, filePath) {
  const size = fs.statSync(filePath).size;
  const contentType = mime.getType(filePath) || 'application/octet-stream';

  await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Content-Length': size,
      'x-ms-blob-type': 'BlockBlob'
    },
    body: fs.readFileSync(filePath)
  });
}

/**
 * Uploads a buffer directly to Azure Blob Storage using signed URL.
 * @param {string} url - The signed upload URL.
 * @param {Buffer} buffer - The buffer to upload.
 * @param {string} contentType - The content type.
 * @returns {Promise<void>}
 */
async function uploadBufferToSignedUrl(url, buffer, contentType = 'application/octet-stream') {
  await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Content-Length': buffer.length,
      'x-ms-blob-type': 'BlockBlob'
    },
    body: buffer
  });
}

/**
 * Uploads a buffer to Azure Blob Private Storage using signed URLs.
 * @param {Object} params
 * @param {string} params.userId - The user's id.
 * @param {Buffer} params.buffer - The buffer to upload.
 * @param {string} params.fileName - The name of the file.
 * @param {string} [params.basePath='images'] - The base folder within the container.
 * @param {string} [params.containerName] - The Azure Blob container name.
 * @returns {Promise<string>} The signed download URL of the uploaded blob.
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
    
    // Generate signed upload URL
    const uploadUrl = await createSASWriteString(
      blobPath, 
      AZURE_PRIVATE_STORAGE_ACCOUNT_KEY, 
      AZURE_PRIVATE_STORAGE_ACCOUNT_NAME, 
      containerName
    );
    
    // Upload buffer using signed URL
    await uploadBufferToSignedUrl(uploadUrl, buffer, contentType);
    
    // Return signed download URL
    return getSignedDownloadUrl(
      blobPath, 
      AZURE_PRIVATE_STORAGE_ACCOUNT_KEY, 
      AZURE_PRIVATE_STORAGE_ACCOUNT_NAME, 
      containerName
    );
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
 * Retrieves a signed download URL from Azure Blob Private Storage.
 * @param {Object} params
 * @param {string} params.fileName - The file name.
 * @param {string} [params.basePath='images'] - The base folder used during upload.
 * @param {string} [params.userId] - If files are stored in a user-specific directory.
 * @param {string} [params.containerName] - The Azure Blob container name.
 * @returns {Promise<string>} The signed download URL.
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
    
    return getSignedDownloadUrl(
      blobPath, 
      AZURE_PRIVATE_STORAGE_ACCOUNT_KEY, 
      AZURE_PRIVATE_STORAGE_ACCOUNT_NAME, 
      containerName
    );
  } catch (error) {
    logger.error('[getAzureBlobPrivateURL] Error retrieving signed URL:', error);
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
 * Uploads a file from the local file system to Azure Blob Private Storage using signed URLs.
 * @param {Object} params
 * @param {object} params.req - The Express request object.
 * @param {Express.Multer.File} params.file - The file object.
 * @param {string} params.file_id - The file id.
 * @param {string} [params.basePath='images'] - The base folder within the container.
 * @param {string} [params.containerName] - The Azure Blob container name.
 * @returns {Promise<{ filepath: string, bytes: number }>} An object containing the signed download URL and its byte size.
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
    
    // Generate signed upload URL
    const uploadUrl = await createSASWriteString(
      blobPath, 
      AZURE_PRIVATE_STORAGE_ACCOUNT_KEY, 
      AZURE_PRIVATE_STORAGE_ACCOUNT_NAME, 
      containerName
    );
    
    // Upload file using signed URL
    await uploadFileToSignedUrl(uploadUrl, inputFilePath);
    
    // Generate signed download URL for return
    const downloadUrl = getSignedDownloadUrl(
      blobPath, 
      AZURE_PRIVATE_STORAGE_ACCOUNT_KEY, 
      AZURE_PRIVATE_STORAGE_ACCOUNT_NAME, 
      containerName
    );
    
    return { filepath: downloadUrl, bytes };
  } catch (error) {
    logger.error('[uploadFileToAzureBlobPrivate] Error uploading file:', error);
    throw error;
  }
}

/**
 * Retrieves a readable stream for a blob from Azure Blob Private Storage.
 * @param {object} _req - The Express request object.
 * @param {string} fileURL - The signed URL of the blob.
 * @returns {Promise<ReadableStream>} A readable stream of the blob.
 */
async function getAzureBlobPrivateFileStream(_req, fileURL) {
  try {
    const response = await axios({
      method: 'get',
      url: fileURL,
      responseType: 'stream',
    });
    return response.data;
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
};
