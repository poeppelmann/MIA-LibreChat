---
name: upstream-merge
description: Merges an upstream release tag (danny-avila/LibreChat) chosen by the developer into the release branch, reviews every MIA customization in the registry, and opens a draft PR. Use for "bring in a new LibreChat version", "merge upstream release into release", "upstream update".
disable-model-invocation: true
---

# Merge an upstream release into `release`

Runs the whole flow up to the draft PR. The agent never merges the PR. A merge into `release` triggers the ACR build (`.github/workflows/acr-build-and-push-libre-chat.yml`) and builds the image `mia:<MIA release>`; the tag is never overwritten.

The human-readable process is `docs/mia/UPSTREAM-UPDATE.md`; the registry format is `docs/mia/README.md`. Customizations live in `docs/mia/customizations/*.md`; there is no other manifest.

## Hard rules

- **Never pick a tag yourself**, and never mark a tag as default or "Recommended". The developer decides.
- **Never invent the Jira ticket or the MIA release.** There is no Jira access; ask the developer (Step 2).
- **Never** run `gh pr merge`, **never** push to `release`, **never** use `--force`.
- Open the PR **only with `--draft`**, never mark it ready for review.
- **No PR** while `npm run mia:validate`, `npm run mia:check` or the tests fail.
- **Never** resolve conflicts wholesale with `--ours`/`--theirs`.
- **Never** decide alone that upstream replaced a customization. Show the evidence and let the developer decide (Step 5).
- Always reference tags as `refs/tags/<tag>` (local branches such as `v0.8.7` make the bare name ambiguous).
- `main` and `mia-dev` are not part of this flow.

## Step 1: Preconditions

1. `git status --porcelain` must be empty, otherwise abort and report.
2. `git remote get-url upstream` must contain `danny-avila/LibreChat`, and `origin` must be `poeppelmann/MIA-LibreChat`. Otherwise abort.
3. `git fetch origin` and `git fetch upstream --tags`.

## Step 2: Tag, ticket and MIA release

1. List the 10 latest upstream tags by date:
   `git tag --list 'v*' --sort=-creatordate | head -10`
   (not `-v:refname`, which sorts final versions after their RCs).
2. Determine the tag last merged into `release` (`OLD_TAG`):
   `git tag --merged origin/release --list 'v*' --sort=-creatordate | head -1`.
   Mark tags that are already contained in `release`.
3. Present them to the developer with `AskUserQuestion`. Put the full list of 10 tags (with date and marker) in the question text. Since at most 4 options are possible, offer the 4 newest as options and let the developer pick any other of the 10 via "Other". Do not mark any option as recommended. Do not continue without an answer.
4. Ask the developer for the **Jira ticket of this update** (`MIA-123`) and the **MIA release** from its epic (`2.4.0`). Validate the formats `^MIA-[0-9]+$` and `^[0-9]+\.[0-9]+\.[0-9]+$`. The MIA release must be greater than `docs/mia/VERSION`.
5. Verify the tag choice: `git rev-parse --verify refs/tags/<NEW_TAG>`.
6. Ask for confirmation if `NEW_TAG` is an RC (`-rc`), is already contained in `release`, or is older than `OLD_TAG`.

## Step 3: Pre-analysis (read-only)

1. `git diff --stat refs/tags/<OLD_TAG> refs/tags/<NEW_TAG> | tail -5`
2. `npm run mia:review -- <OLD_TAG> <NEW_TAG>`: customizations whose files upstream changed. These need a decision in Step 5.
3. Moved or deleted files: `git diff --name-status -M --diff-filter=DR refs/tags/<OLD_TAG> refs/tags/<NEW_TAG>`. Compare the paths with the `files` of the registry. If a file containing custom code was moved or replaced (example from v0.8.7: `api/models/Agent.js` became `packages/api/src/agents/load.ts`), the custom code must be ported to the new file.
4. List separately and show to the developer: changes to `.env.example`, `librechat.yaml`, `Dockerfile*`, the Node version, and `version` in `package.json`.

## Step 4: Merge

```
git checkout -b merge/<JIRA_KEY>-<NEW_TAG>-into-release origin/release
git merge refs/tags/<NEW_TAG>
```

No `--squash`. On conflicts (`git diff --name-only --diff-filter=U`):

- Read both sides of each file. Keep the upstream structure and re-apply the MIA custom block on top of it.
- `package-lock.json`: take the upstream version, then run `npm install` and review the diff.
- If custom and upstream change the same logic and the resolution is not clear: ask the developer.

Commits and the PR title are written in English and follow the conventional format from `.github/CONTRIBUTING.md` (section 4): `type: summary in present tense`, with type one of `chore`, `docs`, `feat`, `fix`, `refactor`, `style`, `test`.

- Merge commit message: `Merge tag '<NEW_TAG>' into release`, followed by the list of conflicts and how each was resolved (this mirrors git's own merge message and is the one exception to the `type:` prefix).
- Any follow-up commit on the merge branch (for example porting custom code): `fix: port <what> to <new file>` or `chore: ...`.
- Use the commit attribution from the system reminder.

## Step 5: Registry decisions (gate before the PR)

1. For every customization from the review (and for the rest, a quick look at the upstream release notes), propose one decision to the developer and wait for the answer:
   - upstream still lacks it: `kind: kept`
   - upstream changed the surrounding code and the MIA change was re-applied: `kind: adapted`, `status: adapted`
   - upstream does the same now: remove the MIA code, `kind: removed`, `status: removed`
2. Write the decision as a new first line in `changes` of that file: `{ mia: <MIA release>, base: <NEW_TAG>, jira: <JIRA_KEY>, kind: ..., note: "..." }`. Drop `checks` that no longer apply together with the code.
3. New customizations get their own file named after the developer's ticket.
4. Set `docs/mia/VERSION` to the MIA release, then `npm run mia:generate` and `npm run mia:validate`.
5. `npm run mia:check -- <NEW_TAG>` and `node scripts/mia/registry.mjs release`. Both must exit 0.
6. Cross-check the file list: `git diff refs/tags/<NEW_TAG> HEAD --name-status`. Every `files` entry of an active customization must appear; explain any unexpected new files.
7. Tests:
   - `cd packages/api && npx jest src/agents`
   - `cd packages/data-provider && npx jest parsers`
   - `node --test "scripts/mia/*.test.mjs"`

If anything fails: fix the cause on the merge branch (port the missing custom code) and rerun. If that does not succeed, **do not open a PR** and report to the developer exactly what is missing.

## Step 6: Build and tests

```
npm run smart-reinstall
npm run build
cd packages/api && npx jest
cd ../../api && npx jest
cd ../packages/api && npx tsc --noEmit
```

Check failures for merge causes first (custom code against the new upstream API). Do not weaken tests. If a failure is clearly upstream-side, note it in the PR.

## Step 7: Draft PR

1. `git push -u origin merge/<JIRA_KEY>-<NEW_TAG>-into-release`
2. `gh pr create -R poeppelmann/MIA-LibreChat --draft --base release --head merge/<JIRA_KEY>-<NEW_TAG>-into-release --title "chore: merge <NEW_TAG> into release"`
3. PR body: write it in English and follow `.github/pull_request_template.md` (sections `Summary`, `Change Type`, `Testing` with `Test Configuration`, `MIA release`, `Checklist`). Delete irrelevant options and tick only what is true.
   - `Summary`: chosen tag and `OLD_TAG`, resolved conflicts, moved files, notes from Step 3 (.env, config, Node, version), and a table of the registry decisions (customization, decision, reason)
   - `Change Type`: tick "New feature" (upstream upgrade, non-breaking) or "Breaking change" if Step 3 found incompatible config/env changes
   - `Testing`: result of `mia:check` (summary line) and of the tests, plus the manual test list: login, chat with streaming, "Image generation" button produces an image, `{{conversation_id}}` is replaced, branding, new env variables set in the target system
   - `MIA release`: `Jira ticket: <JIRA_KEY>` and `MIA release: <MIA release>` exactly in this form (the CI checks them)
   - Mandatory note in `Summary`: "Merging into `release` triggers the ACR build and creates the image tag `mia:<MIA release>` and the git tag `mia-<MIA release>`. Merge only by the developer. Note the rollback digest first."
   - Ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
4. Show `gh pr checks <nr>` once. Do not wait for the merge and do not change anything else on the PR.

## Step 8: Handover

Report briefly: PR link (draft), `mia:check` result, registry decisions awaiting review, open points, manual test list. Note: after the merge, watch the build with `gh run list --workflow acr-build-and-push-libre-chat.yml --limit 1`. The job summary contains the image digest; it is set in `MIA-Config` for dev, test and prod (`docs/mia/UPSTREAM-UPDATE.md`, section 9).
