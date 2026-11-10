# MIA customizations

`release` is upstream LibreChat plus MIA customizations. This folder is the single place that says what
MIA changed, why, since which MIA release, and when it can go away.

| What | Where |
|---|---|
| One file per customization (source of truth) | `docs/mia/customizations/*.md` |
| Overview table (generated) | `docs/mia/OVERVIEW.md` |
| Changelog by MIA release (generated) | `CHANGELOG-MIA.md` |
| Current MIA release | `docs/mia/VERSION` |
| Tooling | `scripts/mia/registry.mjs` (`npm run mia:*`) |
| Step by step upstream update | `docs/mia/UPSTREAM-UPDATE.md` |

## Two version lines

- **MIA release**, e.g. `2.3.0`. It comes from the Jira epic of the ticket. The developer enters it; there is no Jira access from the repo.
- **LibreChat base**, e.g. `v0.8.7`. It is `version` in `package.json` and is set by the upstream merge.

`CHANGELOG-MIA.md` starts with a table that maps every MIA release to its LibreChat base. The image workflow
refuses to build when `docs/mia/VERSION`, the registry and `package.json` disagree.

## A customization file

The file name is the Jira key (`MIA-254.md`). Customizations that existed before the registry (no ticket)
are `baseline-<slug>.md` with `jira: null`; they get a key when someone changes them.

```yaml
---
jira: MIA-254                  # null only for baseline-* files
title: Short name
type: feature                  # feature | fix | branding | infra
status: active                 # active | adapted | removed
valid_until: Condition under which this can be removed (required unless removed)
files: [paths that belong to this customization]
checks:                        # run by `npm run mia:check`, one per line
  - exists path
  - differs path                # file must differ from the upstream tag (branding)
  - contains path => text       # file must contain text
changes:                       # history, one entry per MIA release in which it changed
  - { mia: 2.4.0, base: v0.8.8, jira: MIA-312, kind: kept, note: "Re-checked after the 0.8.8 merge" }
  - { mia: 2.3.0, base: v0.8.7, kind: baseline, note: "Existing when the registry was introduced" }
---
Free text: how it works, how to test it manually, what to watch when merging upstream.
```

`kind` is one of `added`, `changed`, `fixed`, `adapted` (re-applied to a changed upstream), `removed`,
`kept` (checked after an upstream update, nothing to do), `baseline`. A `removed` entry sets
`status: removed`; the file stays as history. `since` and `removed in` in the overview are derived from `changes`.

## Commands

| Command | Purpose |
|---|---|
| `npm run mia:validate` | Format and consistency of the registry |
| `npm run mia:generate` | Regenerate `OVERVIEW.md` and `CHANGELOG-MIA.md` (`-- --check` only verifies) |
| `npm run mia:check -- v0.8.7` | Every customization is still in the working tree, measured against the upstream tag |
| `npm run mia:review -- v0.8.7 v0.8.8` | Which customizations touch files that upstream changed between two tags |

## Pull requests into `release`

Every PR names the Jira ticket and the MIA release (`Jira ticket: MIA-254`, `MIA release: 2.4.0`, see the
PR template) and bumps `docs/mia/VERSION` to that release. A merge into `release` builds an image, so the
version must be new: the workflow fails if the image tag or the git tag `mia-<version>` exists.
Touching a customization means a new `changes` entry plus `npm run mia:generate`. A new customization
needs a new file named after its ticket.

## Image and release artifacts

The workflow `acr-build-and-push-libre-chat.yml` produces, per merge into `release`:

- Image `<acr>/mia:<MIA release>` (tag is immutable; never overwritten). The tag is a label for humans.
- OCI labels `org.opencontainers.image.version`, `.revision`, `.source`, `.created`, `de.poeppelmann.mia.release`, `de.poeppelmann.mia.librechat-version`.
- Git tag `mia-<MIA release>` on the merge commit.
- A job summary with the image **digest**, MIA release and LibreChat base.

Deployment in `MIA-Config` is pinned by digest (ADR-0029), not by tag. The digest from the job summary
goes into `librechat_image_digest` for dev, test and prod. Carrying the two versions into the Helm chart
labels is a follow-up in `MIA-Config` (not part of this repository).
