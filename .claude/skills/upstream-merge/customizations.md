# MIA customizations compared to upstream

Manifest for `check.sh`. Every line in the `manifest` block is a check:

- `contains <path> :: <text>`: file contains the text (fixed string)
- `exists <path>`: file exists
- `differs <path>`: file differs from the upstream tag (branding)

New customization? Add it here, otherwise losing it goes unnoticed.

```manifest
# Image generation (button and backend mapping to gemini_image_gen)
exists client/src/components/Chat/Input/ImageGeneration.tsx
contains client/src/components/Chat/Input/BadgeRow.tsx :: <ImageGeneration />
contains client/src/Providers/BadgeRowContext.tsx :: imageGeneration
contains client/src/hooks/Agents/useAgentCapabilities.ts :: imageGenerationEnabled
contains packages/data-provider/src/config.ts :: image_generation
contains packages/data-provider/src/config.ts :: LAST_IMAGE_GEN_TOGGLE_
contains packages/data-provider/src/types.ts :: image_generation
contains packages/data-provider/src/types/assistants.ts :: gemini_image_gen
contains packages/api/src/agents/load.ts :: Tools.gemini_image_gen
contains packages/api/src/agents/added.ts :: Tools.gemini_image_gen
contains packages/api/src/agents/added.ts :: image_generation
contains packages/api/src/agents/__tests__/load.spec.ts :: gemini_image_gen

# Special variable {{conversation_id}}
contains packages/data-provider/src/config.ts :: conversation_id
contains packages/data-provider/src/parsers.ts :: conversationId
contains packages/api/src/agents/initialize.ts :: conversationId
contains client/src/hooks/Chat/useChatFunctions.ts :: conversationId
contains client/src/hooks/Messages/useSubmitMessage.ts :: conversationId
contains client/src/components/Prompts/utils/specialVariables.ts :: conversation_id
contains client/src/locales/en/translation.json :: conversation_id

# Branding
exists client/manifest.webmanifest
differs client/index.html
differs client/public/assets/logo.svg
differs client/public/assets/favicon-16x16.png
differs client/public/assets/favicon-32x32.png
differs client/public/assets/icon-192x192.png
differs client/public/assets/maskable-icon.png
differs client/public/assets/apple-touch-icon-180x180.png

# CI: build and push to ACR on push to release
exists .github/workflows/acr-build-and-push-libre-chat.yml
contains .github/workflows/acr-build-and-push-libre-chat.yml :: branches: ["release"]
contains .github/workflows/acr-build-and-push-libre-chat.yml :: Dockerfile.multi
```
