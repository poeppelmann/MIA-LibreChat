jest.mock('@librechat/data-schemas', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { logger } from '@librechat/data-schemas';
import {
  DEFAULT_IMAGE_GEN_OAI_DEFAULT_QUALITY,
  DEFAULT_IMAGE_GEN_OAI_DEFAULT_SIZE,
  DEFAULT_IMAGE_GEN_OAI_OUTPUT_COMPRESSION,
  DEFAULT_IMAGE_GEN_OAI_OUTPUT_FORMAT,
  resolveImageGenOaiDefaults,
} from '../image';

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
