jest.mock('@librechat/data-schemas', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import sharp from 'sharp';
import { logger } from '@librechat/data-schemas';
import {
  DEFAULT_IMAGE_GEN_OAI_DEFAULT_QUALITY,
  DEFAULT_IMAGE_GEN_OAI_DEFAULT_SIZE,
  DEFAULT_IMAGE_GEN_OAI_OUTPUT_COMPRESSION,
  DEFAULT_IMAGE_GEN_OAI_OUTPUT_FORMAT,
  DEFAULT_IMAGE_TOOL_RESULT_MAX_BYTES,
  downscaleImageForToolResult,
  resolveImageGenOaiDefaults,
  resolveImageToolResultMaxBytes,
} from '../image';

async function makePngBuffer(width: number, height: number): Promise<Buffer> {
  const channels = 3;
  const raw = Buffer.alloc(width * height * channels);
  for (let i = 0; i < raw.length; i += channels) {
    raw[i] = (i * 7) & 0xff;
    raw[i + 1] = (i * 13) & 0xff;
    raw[i + 2] = (i * 19) & 0xff;
  }
  return sharp(raw, { raw: { width, height, channels } })
    .png({ compressionLevel: 0 })
    .toBuffer();
}

describe('resolveImageToolResultMaxBytes', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.IMAGE_TOOL_RESULT_MAX_FILE_SIZE_BYTES;
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.IMAGE_TOOL_RESULT_MAX_FILE_SIZE_BYTES = originalEnv;
    } else {
      delete process.env.IMAGE_TOOL_RESULT_MAX_FILE_SIZE_BYTES;
    }
  });

  it('returns 2.5 MiB default when env var is not set', () => {
    delete process.env.IMAGE_TOOL_RESULT_MAX_FILE_SIZE_BYTES;
    expect(resolveImageToolResultMaxBytes()).toBe(2_621_440);
    expect(DEFAULT_IMAGE_TOOL_RESULT_MAX_BYTES).toBe(2_621_440);
  });

  it('respects a custom numeric value', () => {
    process.env.IMAGE_TOOL_RESULT_MAX_FILE_SIZE_BYTES = '4194304';
    expect(resolveImageToolResultMaxBytes()).toBe(4194304);
  });

  it('falls back to default and warns for non-numeric string', () => {
    process.env.IMAGE_TOOL_RESULT_MAX_FILE_SIZE_BYTES = 'abc';
    expect(resolveImageToolResultMaxBytes()).toBe(DEFAULT_IMAGE_TOOL_RESULT_MAX_BYTES);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid IMAGE_TOOL_RESULT_MAX_FILE_SIZE_BYTES'),
    );
  });

  it('falls back to default and warns for zero or negative values', () => {
    process.env.IMAGE_TOOL_RESULT_MAX_FILE_SIZE_BYTES = '0';
    expect(resolveImageToolResultMaxBytes()).toBe(DEFAULT_IMAGE_TOOL_RESULT_MAX_BYTES);
    process.env.IMAGE_TOOL_RESULT_MAX_FILE_SIZE_BYTES = '-512';
    expect(resolveImageToolResultMaxBytes()).toBe(DEFAULT_IMAGE_TOOL_RESULT_MAX_BYTES);
  });
});

describe('downscaleImageForToolResult', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the original image untouched when it already fits', async () => {
    const original = await makePngBuffer(64, 64);
    expect(original.length).toBeLessThan(2_621_440);

    const result = await downscaleImageForToolResult(original);

    expect(result.resized).toBe(false);
    expect(result.buffer).toBe(original);
    expect(result.mimeType).toBe('image/png');
    expect(result.base64).toBe(original.toString('base64'));
  });

  it('re-encodes at full resolution before resizing (preserves LLM tokens)', async () => {
    const original = await makePngBuffer(1024, 1024);
    const tightButFormatFixable = 300_000;
    expect(original.length).toBeGreaterThan(tightButFormatFixable);

    const result = await downscaleImageForToolResult(original, tightButFormatFixable);

    expect(result.buffer.length).toBeLessThanOrEqual(tightButFormatFixable);
    expect(['image/webp', 'image/jpeg']).toContain(result.mimeType);
    expect(result.resized).toBe(false);

    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.width).toBe(1024);
    expect(metadata.height).toBe(1024);
  });

  it('falls back to resizing when format conversion alone is insufficient', async () => {
    const original = await makePngBuffer(2048, 2048);
    const veryTightBudget = 30_000;

    const result = await downscaleImageForToolResult(original, veryTightBudget);

    expect(result.buffer.length).toBeLessThanOrEqual(veryTightBudget);
    expect(result.resized).toBe(true);

    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.width).toBeLessThan(2048);
  });
});

describe('resolveImageGenOaiDefaults', () => {
  type OaiEnvKey =
    | 'IMAGE_GEN_OAI_OUTPUT_FORMAT'
    | 'IMAGE_GEN_OAI_OUTPUT_COMPRESSION'
    | 'IMAGE_GEN_OAI_DEFAULT_SIZE'
    | 'IMAGE_GEN_OAI_DEFAULT_QUALITY';

  const keys: OaiEnvKey[] = [
    'IMAGE_GEN_OAI_OUTPUT_FORMAT',
    'IMAGE_GEN_OAI_OUTPUT_COMPRESSION',
    'IMAGE_GEN_OAI_DEFAULT_SIZE',
    'IMAGE_GEN_OAI_DEFAULT_QUALITY',
  ];

  const snapshot: Partial<Record<OaiEnvKey, string | undefined>> = {};

  beforeEach(() => {
    for (const key of keys) {
      snapshot[key] = process.env[key];
      delete process.env[key];
    }
    jest.clearAllMocks();
  });

  afterEach(() => {
    for (const key of keys) {
      const v = snapshot[key];
      if (v !== undefined) {
        process.env[key] = v;
      } else {
        delete process.env[key];
      }
    }
  });

  it('returns built-in defaults when env vars are unset', () => {
    expect(resolveImageGenOaiDefaults()).toEqual({
      outputFormat: DEFAULT_IMAGE_GEN_OAI_OUTPUT_FORMAT,
      outputCompression: DEFAULT_IMAGE_GEN_OAI_OUTPUT_COMPRESSION,
      defaultSize: DEFAULT_IMAGE_GEN_OAI_DEFAULT_SIZE,
      defaultQuality: DEFAULT_IMAGE_GEN_OAI_DEFAULT_QUALITY,
    });
  });

  it('respects valid custom env values', () => {
    process.env.IMAGE_GEN_OAI_OUTPUT_FORMAT = 'png';
    process.env.IMAGE_GEN_OAI_OUTPUT_COMPRESSION = '72';
    process.env.IMAGE_GEN_OAI_DEFAULT_SIZE = '1024x1024';
    process.env.IMAGE_GEN_OAI_DEFAULT_QUALITY = 'medium';

    expect(resolveImageGenOaiDefaults()).toEqual({
      outputFormat: 'png',
      outputCompression: 72,
      defaultSize: '1024x1024',
      defaultQuality: 'medium',
    });
  });

  it('falls back and warns for invalid format', () => {
    process.env.IMAGE_GEN_OAI_OUTPUT_FORMAT = 'gif';
    const defaults = resolveImageGenOaiDefaults();
    expect(defaults.outputFormat).toBe(DEFAULT_IMAGE_GEN_OAI_OUTPUT_FORMAT);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid IMAGE_GEN_OAI_OUTPUT_FORMAT'),
    );
  });

  it('falls back and warns for invalid compression', () => {
    process.env.IMAGE_GEN_OAI_OUTPUT_COMPRESSION = 'x';
    const defaults = resolveImageGenOaiDefaults();
    expect(defaults.outputCompression).toBe(DEFAULT_IMAGE_GEN_OAI_OUTPUT_COMPRESSION);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid IMAGE_GEN_OAI_OUTPUT_COMPRESSION'),
    );
  });

  it('clamps compression outside 0-100 and warns', () => {
    process.env.IMAGE_GEN_OAI_OUTPUT_COMPRESSION = '150';
    expect(resolveImageGenOaiDefaults().outputCompression).toBe(100);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('IMAGE_GEN_OAI_OUTPUT_COMPRESSION'),
    );
  });

  it('falls back for invalid default size', () => {
    process.env.IMAGE_GEN_OAI_DEFAULT_SIZE = '4096x4096';
    expect(resolveImageGenOaiDefaults().defaultSize).toBe(DEFAULT_IMAGE_GEN_OAI_DEFAULT_SIZE);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid IMAGE_GEN_OAI_DEFAULT_SIZE'),
    );
  });

  it('falls back for invalid default quality', () => {
    process.env.IMAGE_GEN_OAI_DEFAULT_QUALITY = 'ultra';
    expect(resolveImageGenOaiDefaults().defaultQuality).toBe(DEFAULT_IMAGE_GEN_OAI_DEFAULT_QUALITY);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid IMAGE_GEN_OAI_DEFAULT_QUALITY'),
    );
  });
});
