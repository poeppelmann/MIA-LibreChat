import sharp from 'sharp';
import { logger } from '@librechat/data-schemas';
import type { FormatEnum } from 'sharp';

/**
 * Anthropic rejects tool-result images whose base64 payload exceeds 5 MiB.
 * The cap stays safely below that so a generated image is accepted by every provider.
 */
export const MAX_IMAGE_BASE64_BYTES = 4.8 * 1024 * 1024;

const FORMAT_MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

/** Approximate base64-encoded length of a buffer (4 output chars per 3 input bytes). */
export function base64Length(byteLength: number): number {
  return Math.ceil(byteLength / 3) * 4;
}

export interface SizeLimitedImage {
  buffer: Buffer;
  mimeType: string;
}

/**
 * Caps a tool-result image at the provider base64 size limit. Re-compresses and,
 * if still too large, progressively downscales the image. Oversized PNGs switch
 * to WebP since lossless PNG cannot compress enough on its own. Returns the
 * original buffer untouched when it is already small enough or when re-encoding
 * fails — a too-large image is preferable to a crashed tool call.
 */
export async function enforceImageSizeLimit(
  inputBuffer: Buffer,
  mimeType: string,
): Promise<SizeLimitedImage> {
  if (base64Length(inputBuffer.length) <= MAX_IMAGE_BASE64_BYTES) {
    return { buffer: inputBuffer, mimeType };
  }

  try {
    const metadata = await sharp(inputBuffer).metadata();
    const detected = metadata.format;
    const targetFormat: keyof FormatEnum =
      detected == null || detected === 'png' ? 'webp' : detected;
    const { width } = metadata;

    let quality = 80;
    let scale = 1;
    let buffer = inputBuffer;
    for (let attempt = 0; attempt < 8; attempt++) {
      const pipeline = sharp(inputBuffer);
      if (scale < 1 && width) {
        pipeline.resize({ width: Math.round(width * scale), withoutEnlargement: true });
      }
      buffer = await pipeline.toFormat(targetFormat, { quality }).toBuffer();
      if (base64Length(buffer.length) <= MAX_IMAGE_BASE64_BYTES) {
        return { buffer, mimeType: FORMAT_MIME_TYPES[targetFormat] ?? mimeType };
      }
      if (quality > 50) {
        quality -= 15;
      } else {
        scale *= 0.8;
      }
    }

    logger.warn(
      '[enforceImageSizeLimit] Image still exceeds size limit after compression attempts',
    );
    return { buffer, mimeType: FORMAT_MIME_TYPES[targetFormat] ?? mimeType };
  } catch (error) {
    logger.error('[enforceImageSizeLimit] Failed to re-encode oversized image', error);
    return { buffer: inputBuffer, mimeType };
  }
}
