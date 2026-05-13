jest.mock('@librechat/data-schemas', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import sharp from 'sharp';
import { logger } from '@librechat/data-schemas';
import {
  DEFAULT_IMAGE_TOOL_RESULT_MAX_BYTES,
  downscaleImageForToolResult,
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

  it('downscales an oversized image to fit the byte budget', async () => {
    const original = await makePngBuffer(1024, 1024);
    const maxBytes = 50_000;
    expect(original.length).toBeGreaterThan(maxBytes);

    const result = await downscaleImageForToolResult(original, maxBytes);

    expect(result.resized).toBe(true);
    expect(result.buffer.length).toBeLessThanOrEqual(maxBytes);
    expect(result.base64).toBe(result.buffer.toString('base64'));
    expect(['image/png', 'image/jpeg']).toContain(result.mimeType);

    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.width).toBeLessThan(1024);
  });

  it('falls back to JPEG when resizing alone cannot satisfy the budget', async () => {
    const original = await makePngBuffer(2048, 2048);
    const veryTightBudget = 2_000;

    const result = await downscaleImageForToolResult(original, veryTightBudget);

    expect(result.resized).toBe(true);
    expect(result.mimeType).toBe('image/jpeg');
  });
});
