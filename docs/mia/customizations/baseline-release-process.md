---
jira: null
title: MIA release process (registry, changelog, upstream-merge skill)
type: infra
status: active
valid_until: Permanent while MIA tracks upstream LibreChat releases.
files:
  - docs/mia/README.md
  - docs/mia/UPSTREAM-UPDATE.md
  - docs/mia/VERSION
  - scripts/mia/registry.mjs
  - scripts/mia/registry.test.mjs
  - .github/workflows/mia-registry.yml
  - .github/pull_request_template.md
  - .claude/skills/upstream-merge/SKILL.md
  - .gitignore
  - CHANGELOG-MIA.md
checks:
  - exists docs/mia/VERSION
  - exists scripts/mia/registry.mjs
  - exists .github/workflows/mia-registry.yml
  - contains .github/pull_request_template.md => MIA release
  - exists .claude/skills/upstream-merge/SKILL.md
changes:
  - { mia: 2.3.0, base: v0.8.7, kind: baseline, note: "Registry, generated overview and changelog, CI checks" }
---

The registry itself is a customization: an upstream merge must not delete it. See
`docs/mia/README.md`.
