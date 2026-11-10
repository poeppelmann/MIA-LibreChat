---
jira: null
title: Node.js 24.22.1 runtime (brotli CVE fix)
type: infra
status: active
valid_until: Remove when the upstream base images and CI use Node.js 24.22.1 or newer.
files:
  - .nvmrc
  - Dockerfile
  - Dockerfile.multi
  - .devcontainer/Dockerfile
  - .do/gitnexus/Dockerfile
  - CLAUDE.md
  - .github/CONTRIBUTING.md
checks:
  - contains .nvmrc => 24.22.1
  - contains Dockerfile => node:24.22.1-alpine
  - contains Dockerfile.multi => 24.22.1
changes:
  - { mia: 2.3.0, base: v0.8.7, kind: baseline, note: "Existing when the registry was introduced" }
---

Upstream pins Node.js 24.16.0 in Dockerfiles, `.nvmrc` and the GitHub workflows. MIA runs 24.22.1.
After an upstream merge, search for `24.16` to find places that fell back to the old version.
