---
jira: null
title: Size limit and defaults for image tool results
type: fix
status: active
valid_until: Remove when upstream caps image tool results below the provider request limits itself.
files:
  - api/app/clients/tools/structured/DALLE3.js
  - api/app/clients/tools/structured/FluxAPI.js
  - api/app/clients/tools/structured/GeminiImageGen.js
  - api/app/clients/tools/structured/OpenAIImageTools.js
  - api/app/clients/tools/structured/StableDiffusion.js
  - api/app/clients/tools/structured/specs/GeminiImageGen-size.spec.js
  - api/app/clients/tools/structured/specs/imageTools-agent.spec.js
  - api/app/clients/tools/structured/specs/imageTools-size.spec.js
  - api/test/app/clients/tools/structured/OpenAIImageTools.test.js
  - packages/api/src/files/images.ts
  - packages/api/src/files/images.spec.ts
  - packages/api/src/files/index.ts
  - packages/api/src/utils/image.ts
  - packages/api/src/utils/index.ts
  - packages/api/src/utils/__tests__/image.test.ts
  - .env.example
checks:
  - contains packages/api/src/files/images.ts => MAX_IMAGE_BASE64_BYTES
  - contains packages/api/src/files/index.ts => images
  - contains packages/api/src/utils/image.ts => resolveImageGenOaiDefaults
  - contains api/app/clients/tools/structured/DALLE3.js => enforceImageSizeLimit
  - contains api/app/clients/tools/structured/FluxAPI.js => enforceImageSizeLimit
  - contains api/app/clients/tools/structured/GeminiImageGen.js => enforceImageSizeLimit
  - contains api/app/clients/tools/structured/OpenAIImageTools.js => enforceImageSizeLimit
  - contains api/app/clients/tools/structured/StableDiffusion.js => enforceImageSizeLimit
  - contains .env.example => IMAGE_GEN_OAI_OUTPUT_FORMAT
changes:
  - { mia: 2.3.0, base: v0.8.7, kind: baseline, note: "Existing when the registry was introduced" }
---

Image tool results are re-encoded below 4.8 MiB (`MAX_IMAGE_BASE64_BYTES`) so that providers do not
reject the tool result. `enforceImageSizeLimit` keeps the MIME type in sync with the re-encoded format.
`resolveImageGenOaiDefaults` derives `image_gen_oai` size, quality and format from the
`IMAGE_GEN_OAI_*` environment variables.

Upstream merge notes: the five image tools share one helper. If upstream refactors one of them,
re-apply the `enforceImageSizeLimit` call there.
