const { saveBufferToAzureBlobPrivate, getAzureBlobPrivateURL } = require('./crud');
const { processImageBuffer } = require('../images');
const { logger } = require('~/config');

const defaultBasePath = 'images';

/**
 * Uploads an image buffer to Azure Blob Private Storage.
 * @param {Object} params
 * @param {string} params.userId - The user's id.
 * @param {Buffer} params.buffer - The image buffer.
 * @param {string} params.fileName - The name of the file.
 * @param {string} [params.basePath='images'] - The base folder within the container.
 * @param {string} [params.containerName] - The Azure Blob container name.
 * @returns {Promise<string>} The signed download URL of the uploaded image.
 */
async function uploadImageToAzureBlobPrivate({
  userId,
  buffer,
  fileName,
  basePath = defaultBasePath,
  containerName,
}) {
  try {
    return await saveBufferToAzureBlobPrivate({
      userId,
      buffer,
      fileName,
      basePath,
      containerName,
    });
  } catch (error) {
    logger.error('[uploadImageToAzureBlobPrivate] Error uploading image:', error);
    throw error;
  }
}

/**
 * Prepares an image URL for Azure Blob Private Storage.
 * @param {Object} params
 * @param {string} params.fileName - The file name.
 * @param {string} [params.basePath='images'] - The base folder used during upload.
 * @param {string} [params.userId] - If files are stored in a user-specific directory.
 * @param {string} [params.containerName] - The Azure Blob container name.
 * @returns {Promise<string>} The signed download URL.
 */
async function prepareAzureBlobPrivateImageURL({ 
  fileName, 
  basePath = defaultBasePath, 
  userId, 
  containerName 
}) {
  try {
    return await getAzureBlobPrivateURL({
      fileName,
      basePath,
      userId,
      containerName,
    });
  } catch (error) {
    logger.error('[prepareAzureBlobPrivateImageURL] Error preparing image URL:', error);
    throw error;
  }
}

/**
 * Processes an avatar image for Azure Blob Private Storage.
 * @param {Object} params
 * @param {string} params.userId - The user's id.
 * @param {Buffer} params.buffer - The image buffer.
 * @param {string} params.fileName - The name of the file.
 * @param {string} [params.basePath='images'] - The base folder within the container.
 * @param {string} [params.containerName] - The Azure Blob container name.
 * @returns {Promise<{ url: string, metadata: object }>} The signed download URL and image metadata.
 */
async function processAzureBlobPrivateAvatar({
  userId,
  buffer,
  fileName,
  basePath = defaultBasePath,
  containerName,
}) {
  try {
    // Process the image buffer to get optimized version and metadata
    const { buffer: processedBuffer, metadata } = await processImageBuffer(buffer);
    
    // Upload the processed image
    const url = await saveBufferToAzureBlobPrivate({
      userId,
      buffer: processedBuffer,
      fileName,
      basePath,
      containerName,
    });

    return {
      url,
      metadata: {
        type: metadata.type,
        width: metadata.width,
        height: metadata.height,
      },
    };
  } catch (error) {
    logger.error('[processAzureBlobPrivateAvatar] Error processing avatar:', error);
    throw error;
  }
}

module.exports = {
  uploadImageToAzureBlobPrivate,
  prepareAzureBlobPrivateImageURL,
  processAzureBlobPrivateAvatar,
};
