---
jira: null
title: MIA branding (title, manifest, icons, logo)
type: branding
status: active
valid_until: Permanent; the product is branded as MIA.
files:
  - client/index.html
  - client/manifest.webmanifest
  - client/public/assets/logo.svg
  - client/public/assets/favicon-16x16.png
  - client/public/assets/favicon-32x32.png
  - client/public/assets/icon-192x192.png
  - client/public/assets/maskable-icon.png
  - client/public/assets/apple-touch-icon-180x180.png
checks:
  - exists client/manifest.webmanifest
  - differs client/index.html
  - differs client/public/assets/logo.svg
  - differs client/public/assets/favicon-16x16.png
  - differs client/public/assets/favicon-32x32.png
  - differs client/public/assets/icon-192x192.png
  - differs client/public/assets/maskable-icon.png
  - differs client/public/assets/apple-touch-icon-180x180.png
changes:
  - { mia: 2.3.0, base: v0.8.7, kind: baseline, note: "Existing when the registry was introduced" }
---

Page title `MIA`, description, PWA manifest and icons. The `differs` checks only prove that the file is
not identical to the upstream tag; verify the look manually after a merge.
