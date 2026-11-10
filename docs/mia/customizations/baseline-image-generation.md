---
jira: null
title: Image generation toggle in the chat menu (Gemini image tool)
type: feature
status: active
valid_until: Remove when upstream ships its own image generation entry in the chat tools menu, or when MIA stops offering Gemini image generation.
files:
  - client/src/components/Chat/Input/ImageGeneration.tsx
  - client/src/components/Chat/Input/BadgeRow.tsx
  - client/src/components/Chat/Input/ToolsDropdown.tsx
  - client/src/components/Chat/Input/__tests__/ToolsDropdown.spec.tsx
  - client/src/Providers/BadgeRowContext.tsx
  - client/src/hooks/Agents/useAgentCapabilities.ts
  - packages/data-provider/src/config.ts
  - packages/data-provider/src/types.ts
  - packages/data-provider/src/types/assistants.ts
  - packages/api/src/agents/added.ts
  - packages/api/src/agents/load.ts
  - packages/api/src/agents/__tests__/load.spec.ts
checks:
  - exists client/src/components/Chat/Input/ImageGeneration.tsx
  - contains client/src/components/Chat/Input/BadgeRow.tsx => <ImageGeneration />
  - contains client/src/Providers/BadgeRowContext.tsx => imageGeneration
  - contains client/src/hooks/Agents/useAgentCapabilities.ts => imageGenerationEnabled
  - contains packages/data-provider/src/config.ts => image_generation
  - contains packages/data-provider/src/config.ts => LAST_IMAGE_GEN_TOGGLE_
  - contains packages/data-provider/src/types.ts => image_generation
  - contains packages/data-provider/src/types/assistants.ts => gemini_image_gen
  - contains packages/api/src/agents/load.ts => Tools.gemini_image_gen
  - contains packages/api/src/agents/added.ts => Tools.gemini_image_gen
  - contains packages/api/src/agents/added.ts => image_generation
  - contains packages/api/src/agents/__tests__/load.spec.ts => gemini_image_gen
changes:
  - { mia: 2.3.0, base: v0.8.7, kind: baseline, note: "Existing when the registry was introduced; flag restored after the v0.8.7 merge and tools dropdown entry fixed" }
---

Adds an "Image generation" entry to the chat tools menu. Enabling it sets the ephemeral agent flag
`image_generation`, which `packages/api/src/agents/added.ts` and `load.ts` map to the
`gemini_image_gen` tool.

Upstream merge notes: the v0.8.7 merge lost the `image_generation` ephemeral agent flag once. Check
`ToolsDropdown.tsx` and `added.ts` first when they conflict.

Manual test: open a new chat, enable "Image generation" in the tools menu, ask for an image.
