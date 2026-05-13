import sharp from 'sharp';
import { logger } from '@librechat/data-schemas';

/** 2.5 MiB — default max byte size for an image returned as a tool result */
export const DEFAULT_IMAGE_TOOL_RESULT_MAX_BYTES = 2_621_440;

/** Width steps tried in order when re-encoding at full resolution still exceeds the byte budget. */
const RESIZE_WIDTH_STEPS = [2048, 1536, 1024, 768, 512, 384, 256];

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

export interface DownscaledImage {
  buffer: Buffer;
  mimeType: string;
  base64: string;
  resized: boolean;
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

async function encodeWebp(pipeline: sharp.Sharp, quality: number): Promise<Buffer> {
  return pipeline.webp({ quality }).toBuffer();
}

async function encodeJpeg(pipeline: sharp.Sharp, quality: number): Promise<Buffer> {
  return pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
}

/**
 * Downscales an image so it fits within the configured per-image byte budget
 * for tool results. Anthropic's API rejects tool_result images larger than
 * 5 MiB, so we keep our default budget well below that.
 *
 * Strategy (token-preserving where possible):
 *  1. If the image already fits, return as-is.
 *  2. Re-encode at FULL resolution as WebP, then JPEG (quality 85). This
 *     preserves the resolution the downstream model sees, so image-input
 *     token usage doesn't change.
 *  3. Only if format conversion alone is insufficient, progressively reduce
 *     resolution (which does reduce LLM input tokens).
 *  4. Final fallback: lowest tested size + JPEG quality 50.
 */
export async function downscaleImageForToolResult(
  buffer: Buffer,
  maxBytes: number = resolveImageToolResultMaxBytes(),
): Promise<DownscaledImage> {
  const metadata = await sharp(buffer).metadata();
  const sourceMime = mimeTypeFromFormat(metadata.format);

  if (buffer.length <= maxBytes) {
    return {
      buffer,
      mimeType: sourceMime,
      base64: buffer.toString('base64'),
      resized: false,
    };
  }

  const webpFullRes = await encodeWebp(sharp(buffer), 85);
  if (webpFullRes.length <= maxBytes) {
    return {
      buffer: webpFullRes,
      mimeType: 'image/webp',
      base64: webpFullRes.toString('base64'),
      resized: false,
    };
  }

  const jpegFullRes = await encodeJpeg(sharp(buffer), 85);
  if (jpegFullRes.length <= maxBytes) {
    return {
      buffer: jpegFullRes,
      mimeType: 'image/jpeg',
      base64: jpegFullRes.toString('base64'),
      resized: false,
    };
  }

  const originalWidth = metadata.width ?? 0;
  for (const width of RESIZE_WIDTH_STEPS) {
    if (originalWidth && width >= originalWidth) {
      continue;
    }
    const resized = sharp(buffer).resize({ width, withoutEnlargement: true });
    const webpResized = await encodeWebp(resized.clone(), 80);
    if (webpResized.length <= maxBytes) {
      return {
        buffer: webpResized,
        mimeType: 'image/webp',
        base64: webpResized.toString('base64'),
        resized: true,
      };
    }
    const jpegResized = await encodeJpeg(resized, 80);
    if (jpegResized.length <= maxBytes) {
      return {
        buffer: jpegResized,
        mimeType: 'image/jpeg',
        base64: jpegResized.toString('base64'),
        resized: true,
      };
    }
  }

  const fallbackWidth = RESIZE_WIDTH_STEPS[RESIZE_WIDTH_STEPS.length - 1];
  const fallback = await encodeJpeg(
    sharp(buffer).resize({ width: fallbackWidth, withoutEnlargement: true }),
    50,
  );

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

export type ImageGenOaiSize = 'auto' | '1024x1024' | '1536x1024' | '1024x1536';
export type ImageGenOaiQuality = 'auto' | 'high' | 'medium' | 'low';
export type ImageGenOaiFormat = 'png' | 'jpeg' | 'webp';

/** Includes DALL·E 2 edit sizes supported by `image_edit_oai`. */
export type ImageGenOaiDefaultSize = ImageGenOaiSize | '256x256' | '512x512';

export interface ImageGenOaiDefaults {
  /** Output format requested from the OpenAI image API. */
  outputFormat: ImageGenOaiFormat;
  /** output_compression value (0-100), only honored for JPEG/WebP. */
  outputCompression: number;
  /** Default size to send when the model leaves it as `auto`. */
  defaultSize: ImageGenOaiDefaultSize;
  /** Default quality to send when the model leaves it as `auto`. */
  defaultQuality: ImageGenOaiQuality;
}

export const DEFAULT_IMAGE_GEN_OAI_OUTPUT_FORMAT: ImageGenOaiFormat = 'jpeg';
export const DEFAULT_IMAGE_GEN_OAI_OUTPUT_COMPRESSION = 85;
export const DEFAULT_IMAGE_GEN_OAI_DEFAULT_SIZE: ImageGenOaiDefaultSize = 'auto';
export const DEFAULT_IMAGE_GEN_OAI_DEFAULT_QUALITY: ImageGenOaiQuality = 'auto';

const ALLOWED_OUTPUT_FORMATS: readonly ImageGenOaiFormat[] = ['png', 'jpeg', 'webp'];
const ALLOWED_DEFAULT_SIZES: readonly ImageGenOaiDefaultSize[] = [
  'auto',
  '1024x1024',
  '1536x1024',
  '1024x1536',
  '256x256',
  '512x512',
];
const ALLOWED_DEFAULT_QUALITIES: readonly ImageGenOaiQuality[] = [
  'auto',
  'high',
  'medium',
  'low',
];

function parseOutputFormat(raw: string | undefined): ImageGenOaiFormat {
  if (!raw) {
    return DEFAULT_IMAGE_GEN_OAI_OUTPUT_FORMAT;
  }
  const normalized = raw.trim().toLowerCase() as ImageGenOaiFormat;
  if (!ALLOWED_OUTPUT_FORMATS.includes(normalized)) {
    logger.warn(
      `[image] Invalid IMAGE_GEN_OAI_OUTPUT_FORMAT="${raw}"; using ${DEFAULT_IMAGE_GEN_OAI_OUTPUT_FORMAT}`,
    );
    return DEFAULT_IMAGE_GEN_OAI_OUTPUT_FORMAT;
  }
  return normalized;
}

function parseOutputCompression(raw: string | undefined): number {
  if (!raw) {
    return DEFAULT_IMAGE_GEN_OAI_OUTPUT_COMPRESSION;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    logger.warn(
      `[image] Invalid IMAGE_GEN_OAI_OUTPUT_COMPRESSION="${raw}"; using ${DEFAULT_IMAGE_GEN_OAI_OUTPUT_COMPRESSION}`,
    );
    return DEFAULT_IMAGE_GEN_OAI_OUTPUT_COMPRESSION;
  }
  const rounded = Math.round(parsed);
  if (rounded < 0 || rounded > 100) {
    const clamped = Math.min(100, Math.max(0, rounded));
    logger.warn(
      `[image] IMAGE_GEN_OAI_OUTPUT_COMPRESSION="${raw}" out of range; using ${clamped} (allowed 0-100)`,
    );
    return clamped;
  }
  return rounded;
}

function parseDefaultSize(raw: string | undefined): ImageGenOaiDefaultSize {
  if (!raw) {
    return DEFAULT_IMAGE_GEN_OAI_DEFAULT_SIZE;
  }
  const normalized = raw.trim().toLowerCase() as ImageGenOaiDefaultSize;
  if (!ALLOWED_DEFAULT_SIZES.includes(normalized)) {
    logger.warn(
      `[image] Invalid IMAGE_GEN_OAI_DEFAULT_SIZE="${raw}"; using ${DEFAULT_IMAGE_GEN_OAI_DEFAULT_SIZE}`,
    );
    return DEFAULT_IMAGE_GEN_OAI_DEFAULT_SIZE;
  }
  return normalized;
}

function parseDefaultQuality(raw: string | undefined): ImageGenOaiQuality {
  if (!raw) {
    return DEFAULT_IMAGE_GEN_OAI_DEFAULT_QUALITY;
  }
  const normalized = raw.trim().toLowerCase() as ImageGenOaiQuality;
  if (!ALLOWED_DEFAULT_QUALITIES.includes(normalized)) {
    logger.warn(
      `[image] Invalid IMAGE_GEN_OAI_DEFAULT_QUALITY="${raw}"; using ${DEFAULT_IMAGE_GEN_OAI_DEFAULT_QUALITY}`,
    );
    return DEFAULT_IMAGE_GEN_OAI_DEFAULT_QUALITY;
  }
  return normalized;
}

/**
 * Reads OpenAI `image_gen_oai` / `image_edit_oai` request defaults from env.
 * JPEG remains the suggested default: both the direct OpenAI API and Azure
 * OpenAI gpt-image-1 accept it; Azure may reject `webp`.
 */
export function resolveImageGenOaiDefaults(): ImageGenOaiDefaults {
  return {
    outputFormat: parseOutputFormat(process.env.IMAGE_GEN_OAI_OUTPUT_FORMAT),
    outputCompression: parseOutputCompression(process.env.IMAGE_GEN_OAI_OUTPUT_COMPRESSION),
    defaultSize: parseDefaultSize(process.env.IMAGE_GEN_OAI_DEFAULT_SIZE),
    defaultQuality: parseDefaultQuality(process.env.IMAGE_GEN_OAI_DEFAULT_QUALITY),
  };
}
