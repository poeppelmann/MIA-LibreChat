import sharp from 'sharp';
import { logger } from '@librechat/data-schemas';
import type { FormatEnum } from 'sharp';

/**
 * Providers reject tool-result images above a per-image base64 limit (Anthropic returns
 * `invalid_request_error`). The cap stays well below it so a generated image is accepted
 * by every provider.
 */
export const MAX_IMAGE_BASE64_BYTES: number = 4.8 * 1024 * 1024;

/** Lossy formats kept on re-encode; anything else is re-encoded as WebP. */
const LOSSY_MIME_TYPES: Partial<Record<keyof FormatEnum, string>> = {
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export interface SizeLimitedImage {
  buffer: Buffer;
  mimeType: string;
}

/** Padded base64-encoded length of a buffer (4 output chars per 3 input bytes). */
export function base64Length(byteLength: number): number {
  return Math.ceil(byteLength / 3) * 4;
}

/**
 * Caps a tool-result image at the provider base64 size limit. Re-compresses and,
 * if still too large, progressively downscales the image. Formats other than JPEG
 * and WebP switch to WebP since lossless formats cannot compress enough on their own. Returns the
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
    const { format, width } = await sharp(inputBuffer).metadata();
    const keepFormat = format != null && LOSSY_MIME_TYPES[format] != null;
    const targetFormat: keyof FormatEnum = keepFormat ? format : 'webp';
    const targetMimeType = LOSSY_MIME_TYPES[targetFormat] ?? 'image/webp';

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
        return { buffer, mimeType: targetMimeType };
      }
      if (quality > 50) {
        quality -= 15;
      } else if (width) {
        scale *= 0.8;
      } else {
        break;
      }
    }

    logger.warn(
      '[enforceImageSizeLimit] Image still exceeds size limit after compression attempts',
    );
    return { buffer, mimeType: targetMimeType };
  } catch (error) {
    logger.error('[enforceImageSizeLimit] Failed to re-encode oversized image', error);
    return { buffer: inputBuffer, mimeType };
  }
}
