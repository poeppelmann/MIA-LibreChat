import { logger } from '@librechat/data-schemas';

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
