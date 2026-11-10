---
jira: null
title: Image build and push to ACR
type: infra
status: active
valid_until: Permanent while MIA publishes its own image.
files:
  - .github/workflows/acr-build-and-push-libre-chat.yml
checks:
  - exists .github/workflows/acr-build-and-push-libre-chat.yml
  - 'contains .github/workflows/acr-build-and-push-libre-chat.yml => branches: ["release"]'
  - contains .github/workflows/acr-build-and-push-libre-chat.yml => Dockerfile.multi
changes:
  - { mia: 2.3.0, base: v0.8.7, kind: baseline, note: "Existing when the registry was introduced" }
---

Every push to `release` builds `Dockerfile.multi` and pushes the image to the project ACR. See
`docs/mia/README.md` for the tag scheme, the labels and the handover to `MIA-Config` (deployment is
pinned by digest there).
