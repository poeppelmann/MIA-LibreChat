import sharp from 'sharp';
import { base64Length, enforceImageSizeLimit, MAX_IMAGE_BASE64_BYTES } from './images';

describe('base64Length', () => {
  it('computes the encoded length as 4 chars per 3 input bytes', () => {
    expect(base64Length(3)).toBe(4);
    expect(base64Length(6)).toBe(8);
    expect(base64Length(1)).toBe(4);
    expect(base64Length(0)).toBe(0);
  });
});

describe('enforceImageSizeLimit', () => {
  it('returns a small image untouched', async () => {
    const small = await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer();

    const result = await enforceImageSizeLimit(small, 'image/png');

    expect(result.buffer).toBe(small);
    expect(result.mimeType).toBe('image/png');
  });

  it('downscales an oversized PNG under the base64 limit and switches to WebP', async () => {
    const huge = await sharp({
      create: {
        width: 2048,
        height: 2048,
        channels: 3,
        noise: { type: 'gaussian', mean: 128, sigma: 60 },
      },
    })
      .png()
      .toBuffer();
    expect(base64Length(huge.length)).toBeGreaterThan(MAX_IMAGE_BASE64_BYTES);

    const result = await enforceImageSizeLimit(huge, 'image/png');

    expect(base64Length(result.buffer.length)).toBeLessThanOrEqual(MAX_IMAGE_BASE64_BYTES);
    expect(result.mimeType).toBe('image/webp');

    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe('webp');
  }, 30000);

  it('returns the original buffer when the input is not a decodable image', async () => {
    const garbage = Buffer.alloc(6 * 1024 * 1024, 1);

    const result = await enforceImageSizeLimit(garbage, 'image/png');

    expect(result.buffer).toBe(garbage);
    expect(result.mimeType).toBe('image/png');
  });
});
