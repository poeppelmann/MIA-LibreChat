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

export interface ImageGenOaiDefaults {
  /** Output format requested from the OpenAI image API. */
  outputFormat: ImageGenOaiFormat;
  /** output_compression value (0-100), only honored for JPEG/WebP. */
  outputCompression: number;
  /** Default size to send when the model leaves it as `auto`. */
  defaultSize: ImageGenOaiSize;
  /** Default quality to send when the model leaves it as `auto`. */
  defaultQuality: ImageGenOaiQuality;
}

/**
 * Maps the configured tool-result byte budget to safe defaults for the OpenAI
 * `image_gen_oai` / `image_edit_oai` tool calls. The point is to let
 * IMAGE_TOOL_RESULT_MAX_FILE_SIZE_BYTES *also* drive the upstream generation
 * request, so OpenAI returns a smaller image directly instead of us shrinking
 * it after the fact.
 *
 * JPEG is chosen as the default format because it is the only non-PNG format
 * supported by both the direct OpenAI API and Azure OpenAI's gpt-image-1
 * deployments. (Azure currently rejects `webp`.)
 *
 * The thresholds are intentionally coarse — finer tuning would mostly add
 * complexity without a meaningful win.
 */
export function deriveImageGenOaiDefaults(
  maxBytes: number = resolveImageToolResultMaxBytes(),
): ImageGenOaiDefaults {
  if (maxBytes >= 5_000_000) {
    return {
      outputFormat: 'jpeg',
      outputCompression: 95,
      defaultSize: 'auto',
      defaultQuality: 'high',
    };
  }
  if (maxBytes >= 2_000_000) {
    return {
      outputFormat: 'jpeg',
      outputCompression: 85,
      defaultSize: 'auto',
      defaultQuality: 'auto',
    };
  }
  if (maxBytes >= 800_000) {
    return {
      outputFormat: 'jpeg',
      outputCompression: 75,
      defaultSize: '1024x1024',
      defaultQuality: 'medium',
    };
  }
  return {
    outputFormat: 'jpeg',
    outputCompression: 60,
    defaultSize: '1024x1024',
    defaultQuality: 'low',
  };
}
