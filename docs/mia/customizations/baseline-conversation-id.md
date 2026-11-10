---
jira: null
title: Special variable {{conversation_id}}
type: feature
status: active
valid_until: Remove when upstream offers a conversation id special variable.
files:
  - packages/data-provider/src/config.ts
  - packages/data-provider/src/parsers.ts
  - packages/data-provider/specs/parsers.spec.ts
  - packages/api/src/agents/initialize.ts
  - client/src/hooks/Chat/useChatFunctions.ts
  - client/src/hooks/Messages/useSubmitMessage.ts
  - client/src/components/Prompts/utils/specialVariables.ts
  - client/src/locales/en/translation.json
checks:
  - contains packages/data-provider/src/config.ts => conversation_id
  - contains packages/data-provider/src/parsers.ts => conversationId
  - contains packages/api/src/agents/initialize.ts => conversationId
  - contains client/src/hooks/Chat/useChatFunctions.ts => conversationId
  - contains client/src/hooks/Messages/useSubmitMessage.ts => conversationId
  - contains client/src/components/Prompts/utils/specialVariables.ts => conversation_id
  - contains client/src/locales/en/translation.json => conversation_id
changes:
  - { mia: 2.3.0, base: v0.8.7, kind: baseline, note: "Existing when the registry was introduced" }
---

Prompts and agent instructions can use `{{conversation_id}}`; it is replaced by the current
conversation id from the URL.

Manual test: create a prompt containing `{{conversation_id}}`, use it in a chat, check the replaced id.
