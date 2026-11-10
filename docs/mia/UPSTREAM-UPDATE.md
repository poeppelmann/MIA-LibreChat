# Updating to a new LibreChat release

A new LibreChat version is merged into `release` as a tag, never from `main` or `mia-dev`. Each customization
in `docs/mia/customizations/` is then checked: keep it, adapt it, or remove it because upstream solved it.

The Claude skill `upstream-merge` automates steps 3 to 8 and asks for the values in step 1. The steps are the
same without it.

## 1. Ticket and versions (developer provides)

- Jira ticket for the update, e.g. `MIA-312`.
- MIA release from the epic, e.g. `2.4.0`.
- The upstream tag, e.g. `v0.8.8`. Check upstream release notes first; prefer final tags over `-rc`.

## 2. Preconditions

`git status` is clean, `origin` is `poeppelmann/MIA-LibreChat`, `upstream` is `danny-avila/LibreChat`,
`git fetch origin && git fetch upstream --tags`.

## 3. Pre-analysis

```
npm run mia:review -- <OLD_TAG> <NEW_TAG>
```

Lists the customizations whose files upstream changed. Those need attention in step 5. Also read moved or
deleted files (`git diff --name-status -M --diff-filter=DR <OLD_TAG> <NEW_TAG>`) and changes to
`.env.example`, `Dockerfile*`, the Node version and `package.json`.

## 4. Merge

```
git checkout -b merge/MIA-312-<NEW_TAG>-into-release origin/release
git merge refs/tags/<NEW_TAG>
```

No squash. Resolve conflicts by keeping the upstream structure and re-applying the MIA change on top.
Never use `--ours` or `--theirs` for whole files.

## 5. Decide per customization

For every customization from the review (and a glance at the others):

| Decision | What to do in the registry |
|---|---|
| Upstream still lacks it | `kind: kept` |
| Upstream changed the surrounding code, MIA change re-applied | `kind: adapted`, `status: adapted` |
| Upstream now does the same | remove the MIA code, `kind: removed`, `status: removed` |

Each decision is a new line in `changes` with `mia`, `base`, `jira` (the update ticket) and a note.
Remove `checks` that are no longer valid together with the code. New customizations from this update get their own file named after their ticket.

## 6. Version and generated files

- `docs/mia/VERSION` to the new MIA release.
- `npm run mia:generate`.
- `npm run mia:validate`.

## 7. Gate

```
npm run mia:check -- <NEW_TAG>
node scripts/mia/registry.mjs release
npm run smart-reinstall && npm run build
cd packages/api && npx jest && npx tsc --noEmit
cd ../../api && npx jest
```

No PR while one of these fails.

## 8. Draft PR into `release`

Title `chore: merge <NEW_TAG> into release`, body from the PR template with `Jira ticket:` and `MIA release:`,
the review table from step 5 and the manual test list (login, chat streaming, "Image generation", `{{conversation_id}}`,
branding). Mention that merging builds the image `mia:<MIA release>`.

## 9. After the merge (developer)

1. The workflow builds the image, tags the commit `mia-<MIA release>` and writes the digest into the job summary.
2. Scan the digest (Trivy), then set it in `MIA-Config` for dev, test and prod. Note the previous digest as rollback.
3. Close the Jira ticket and move it to the epic's release.
