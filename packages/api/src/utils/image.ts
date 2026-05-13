import sharp from 'sharp';
import { logger } from '@librechat/data-schemas';

/** 2.5 MiB — default max byte size for an image returned as a tool result */
export const DEFAULT_IMAGE_TOOL_RESULT_MAX_BYTES = 2_621_440;

/** Width steps tried in order when the source image exceeds the byte budget. */
const RESIZE_WIDTH_STEPS = [2048, 1536, 1024, 768, 512, 384, 256];

/** JPEG quality steps tried after width steps are exhausted. */
const JPEG_QUALITY_STEPS = [80, 65, 50, 35];

export interface DownscaledImage {
  buffer: Buffer;
  mimeType: string;
  base64: string;
  resized: boolean;
}

/** Resolves the per-image byte budget for tool results from the env var, falling back to the 2.5 MiB default. */
export function resolveImageToolResultMaxBytes(): number {
  const raw = process.env.IMAGE_TOOL_RESULT_MAX_FILE_SIZE_BYTES;
  if (!raw) {
    return DEFAULT_IMAGE_TOOL_RESULT_MAX_BYTES;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    logger.warn(
      `[image] Invalid IMAGE_TOOL_RESULT_MAX_FILE_SIZE_BYTES="${raw}"; using default ${DEFAULT_IMAGE_TOOL_RESULT_MAX_BYTES}`,
    );
    return DEFAULT_IMAGE_TOOL_RESULT_MAX_BYTES;
  }
  return parsed;
}

function mimeTypeFromFormat(format: string | undefined): string {
  switch (format) {
    case 'jpeg':
    case 'jpg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    default:
      return 'image/png';
  }
}

async function encodePreservingFormat(
  pipeline: sharp.Sharp,
  sourceFormat: string | undefined,
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (sourceFormat === 'jpeg' || sourceFormat === 'jpg') {
    const buffer = await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    return { buffer, mimeType: 'image/jpeg' };
  }
  if (sourceFormat === 'webp') {
    const buffer = await pipeline.webp({ quality: 85 }).toBuffer();
    return { buffer, mimeType: 'image/webp' };
  }
  const buffer = await pipeline.png({ compressionLevel: 9, palette: true }).toBuffer();
  return { buffer, mimeType: 'image/png' };
}

/**
 * Downscales an image so it fits within the configured per-image byte budget
 * for tool results. Anthropic's API rejects tool_result images larger than
 * 5 MiB, so we keep our default budget well below that.
 *
 * Returns the original image untouched when it already fits.
 * Falls back to progressively lower JPEG quality if PNG/WebP cannot be shrunk
 * enough by resizing alone.
 */
export async function downscaleImageForToolResult(
  buffer: Buffer,
  maxBytes: number = resolveImageToolResultMaxBytes(),
): Promise<DownscaledImage> {
  const metadata = await sharp(buffer).metadata();
  const sourceFormat = metadata.format;
  const sourceMime = mimeTypeFromFormat(sourceFormat);

  if (buffer.length <= maxBytes) {
    return {
      buffer,
      mimeType: sourceMime,
      base64: buffer.toString('base64'),
      resized: false,
    };
  }

  const originalWidth = metadata.width ?? 0;

  for (const width of RESIZE_WIDTH_STEPS) {
    if (originalWidth && width >= originalWidth) {
      continue;
    }
    const pipeline = sharp(buffer).resize({ width, withoutEnlargement: true });
    const { buffer: encoded, mimeType } = await encodePreservingFormat(pipeline, sourceFormat);
    if (encoded.length <= maxBytes) {
      return {
        buffer: encoded,
        mimeType,
        base64: encoded.toString('base64'),
        resized: true,
      };
    }
  }

  for (const width of RESIZE_WIDTH_STEPS) {
    for (const quality of JPEG_QUALITY_STEPS) {
      const encoded = await sharp(buffer)
        .resize({ width, withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      if (encoded.length <= maxBytes) {
        return {
          buffer: encoded,
          mimeType: 'image/jpeg',
          base64: encoded.toString('base64'),
          resized: true,
        };
      }
    }
  }

  const fallbackWidth = RESIZE_WIDTH_STEPS[RESIZE_WIDTH_STEPS.length - 1];
  const fallbackQuality = JPEG_QUALITY_STEPS[JPEG_QUALITY_STEPS.length - 1];
  const fallback = await sharp(buffer)
    .resize({ width: fallbackWidth, withoutEnlargement: true })
    .jpeg({ quality: fallbackQuality, mozjpeg: true })
    .toBuffer();

  logger.warn(
    `[image] Unable to shrink tool-result image under ${maxBytes} bytes; sending ${fallback.length} bytes (smallest available)`,
  );

  return {
    buffer: fallback,
    mimeType: 'image/jpeg',
    base64: fallback.toString('base64'),
    resized: true,
  };
}
