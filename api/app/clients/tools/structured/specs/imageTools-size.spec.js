/**
 * Verifies that image tools running in agent mode cap the base64 image in the
 * tool result at the provider size limit (see `enforceImageSizeLimit`).
 */

const fs = require('fs');
const axios = require('axios');
const sharp = require('sharp');
const OpenAI = require('openai');
const undici = require('undici');
const fetch = require('node-fetch');
const { MAX_IMAGE_BASE64_BYTES } = require('@librechat/api');
const createOpenAIImageTools = require('../OpenAIImageTools');
const StableDiffusionAPI = require('../StableDiffusion');
const FluxAPI = require('../FluxAPI');
const DALLE3 = require('../DALLE3');

jest.mock('axios');
jest.mock('openai');
jest.mock('node-fetch');
jest.mock('undici', () => ({
  ...jest.requireActual('undici'),
  ProxyAgent: jest.fn(),
  fetch: jest.fn(),
}));
jest.mock('~/server/services/Files/strategies', () => ({
  getStrategyFunctions: jest.fn(),
}));
jest.mock('~/models', () => ({
  getFiles: jest.fn().mockResolvedValue([]),
}));

const ENV_KEYS = [
  'DALLE_API_KEY',
  'FLUX_API_KEY',
  'SD_WEBUI_URL',
  'IMAGE_GEN_OAI_API_KEY',
  'PROXY',
];

let oversizedPng;

const makeToolCall = (name, args) => ({ id: 'call_size_1', name, args, type: 'tool_call' });

const imageResponse = (buffer) => ({
  headers: { get: () => 'image/png' },
  arrayBuffer: () => Promise.resolve(buffer),
});

const CAPPED = { mimeType: 'image/webp', fitsLimit: true };

/** Reads the MIME type of the tool-result image and whether its base64 fits the limit. */
function summarizeImage(message) {
  const [image] = message.artifact.content;
  const [, mimeType, data] = image.image_url.url.match(/^data:([^;]+);base64,(.*)$/);
  return { mimeType, fitsLimit: data.length <= MAX_IMAGE_BASE64_BYTES };
}

describe('image tools - agent mode tool-result size cap', () => {
  let savedEnv = {};

  beforeAll(async () => {
    oversizedPng = await sharp({
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
  });

  beforeEach(() => {
    jest.clearAllMocks();
    savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
    process.env.DALLE_API_KEY = 'test-dalle-key';
    process.env.FLUX_API_KEY = 'test-flux-key';
    process.env.SD_WEBUI_URL = 'http://localhost:7860';
    process.env.IMAGE_GEN_OAI_API_KEY = 'test-oai-key';
    delete process.env.PROXY;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('uses a fixture that exceeds the limit', () => {
    expect(oversizedPng.toString('base64').length).toBeGreaterThan(MAX_IMAGE_BASE64_BYTES);
  });

  it('DALLE3 caps an oversized image', async () => {
    OpenAI.mockImplementation(() => ({
      images: {
        generate: jest.fn().mockResolvedValue({ data: [{ url: 'https://example.com/a.png' }] }),
      },
    }));
    undici.fetch.mockResolvedValue(imageResponse(oversizedPng));

    const dalle = new DALLE3({ isAgent: true });
    const message = await dalle.invoke(
      makeToolCall('dalle', {
        prompt: 'a box',
        quality: 'standard',
        size: '1024x1024',
        style: 'vivid',
      }),
    );

    expect(summarizeImage(message)).toEqual(CAPPED);
  }, 30000);

  describe('FluxAPI', () => {
    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
      axios.post.mockResolvedValue({ data: { id: 'task-123' } });
      axios.get.mockResolvedValue({
        data: { status: 'Ready', result: { sample: 'https://example.com/a.png' } },
      });
      fetch.mockResolvedValue(imageResponse(oversizedPng));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it.each([
      ['generate', { prompt: 'a box', endpoint: '/v1/flux-dev' }],
      [
        'generate_finetuned',
        {
          action: 'generate_finetuned',
          prompt: 'a box',
          finetune_id: 'ft-1',
          endpoint: '/v1/flux-pro-finetuned',
        },
      ],
    ])(
      'caps an oversized image for %s',
      async (_action, args) => {
        const flux = new FluxAPI({ isAgent: true });
        const invokePromise = flux.invoke(makeToolCall('flux', args));
        await jest.runAllTimersAsync();
        const message = await invokePromise;

        expect(summarizeImage(message)).toEqual(CAPPED);
      },
      30000,
    );
  });

  it('StableDiffusion caps an oversized image', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    axios.post.mockResolvedValue({
      data: {
        images: [oversizedPng.toString('base64')],
        info: JSON.stringify({ height: 2048, width: 2048, seed: 42, infotexts: [] }),
      },
    });

    const sd = new StableDiffusionAPI({ isAgent: true, override: true, userId: 'user-1' });
    const message = await sd.invoke(
      makeToolCall('stable-diffusion', { prompt: 'a box', negative_prompt: '' }),
    );

    expect(summarizeImage(message)).toEqual(CAPPED);
  }, 30000);

  it('image_gen_oai caps an oversized image', async () => {
    OpenAI.mockImplementation(() => ({
      images: {
        generate: jest.fn().mockResolvedValue({
          data: [{ b64_json: oversizedPng.toString('base64') }],
        }),
      },
    }));

    const [imageGenTool] = createOpenAIImageTools({ isAgent: true, req: { user: { id: 'u1' } } });
    const message = await imageGenTool.invoke(
      makeToolCall('image_gen_oai', { prompt: 'a box', background: 'transparent' }),
    );

    expect(summarizeImage(message)).toEqual(CAPPED);
  }, 30000);
});
