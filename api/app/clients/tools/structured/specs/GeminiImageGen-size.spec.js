const sharp = require('sharp');
const { MAX_IMAGE_BASE64_BYTES } = require('@librechat/api');

const mockGenerateContent = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}));

jest.mock('~/models', () => ({
  spendTokens: jest.fn(),
  getFiles: jest.fn(),
}));

jest.mock('~/server/services/Files/strategies', () => ({
  getStrategyFunctions: jest.fn(),
}));

const createGeminiImageTool = require('../GeminiImageGen');

function geminiResponse(buffer) {
  return {
    candidates: [
      {
        finishReason: 'STOP',
        content: {
          parts: [{ inlineData: { mimeType: 'image/png', data: buffer.toString('base64') } }],
        },
      },
    ],
  };
}

async function invokeTool() {
  const geminiTool = createGeminiImageTool({ isAgent: true, GEMINI_API_KEY: 'test-key' });
  const message = await geminiTool.invoke({
    id: 'call_1',
    name: 'gemini_image_gen',
    type: 'tool_call',
    args: { prompt: 'a test image' },
  });
  const [image] = message.artifact.content;
  const [, mimeType, data] = image.image_url.url.match(/^data:([^;]+);base64,(.*)$/);
  return { mimeType, data };
}

describe('GeminiImageGen tool-result image size', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps a small generated image unchanged', async () => {
    const small = await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer();
    mockGenerateContent.mockResolvedValue(geminiResponse(small));

    const { mimeType, data } = await invokeTool();

    expect(mimeType).toBe('image/png');
    expect(data).toBe(small.toString('base64'));
  });

  it('shrinks an oversized generated image below the provider limit', async () => {
    const huge = await sharp({
      create: {
        width: 2048,
        height: 2048,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
        noise: { type: 'gaussian', mean: 128, sigma: 60 },
      },
    })
      .png()
      .toBuffer();
    mockGenerateContent.mockResolvedValue(geminiResponse(huge));

    const { mimeType, data } = await invokeTool();

    expect(huge.toString('base64').length).toBeGreaterThan(MAX_IMAGE_BASE64_BYTES);
    expect(data.length).toBeLessThanOrEqual(MAX_IMAGE_BASE64_BYTES);
    expect(mimeType).toBe('image/webp');
  }, 30000);
});
