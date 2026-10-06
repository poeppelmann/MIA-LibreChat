---
name: upstream-merge
description: Merges an upstream release tag (danny-avila/LibreChat) chosen by the developer into the release branch, verifies the MIA customizations, and opens a draft PR. Use for "bring in a new LibreChat version", "merge upstream release into release", "upstream update".
disable-model-invocation: true
---

# Merge an upstream release into `release`

Runs the whole flow up to the draft PR. The agent never merges the PR. A merge into `release` triggers the ACR build (`.github/workflows/acr-build-and-push-libre-chat.yml`) and overwrites the image tag `mia:<package.json version>`.

## Hard rules

- **Never pick a tag yourself**, and never mark a tag as default or "Recommended". The developer decides.
- **Never** run `gh pr merge`, **never** push to `release`, **never** use `--force`.
- Open the PR **only with `--draft`**, never mark it ready for review.
- **No PR** while `check.sh` or the tests fail.
- **Never** resolve conflicts wholesale with `--ours`/`--theirs`.
- Always reference tags as `refs/tags/<tag>` (local branches such as `v0.8.7` make the bare name ambiguous).
- `main` and `mia-dev` are not part of this flow.

## Step 1: Preconditions

1. `git status --porcelain` must be empty, otherwise abort and report.
2. `git remote get-url upstream` must contain `danny-avila/LibreChat`, and `origin` must be `poeppelmann/MIA-LibreChat`. Otherwise abort.
3. `git fetch origin` and `git fetch upstream --tags`.

## Step 2: Tag selection

1. List the 10 latest upstream tags by date:
   `git tag --list 'v*' --sort=-creatordate | head -10`
   (not `-v:refname`, which sorts final versions after their RCs).
2. Determine the tag last merged into `release` (`OLD_TAG`):
   `git tag --merged origin/release --list 'v*' --sort=-creatordate | head -1`.
   Mark tags that are already contained in `release`.
3. Present them to the developer with `AskUserQuestion`. Put the full list of 10 tags (with date and marker) in the question text. Since at most 4 options are possible, offer the 4 newest as options and let the developer pick any other of the 10 via "Other". Do not mark any option as recommended. Do not continue without an answer.
4. Verify the choice: `git rev-parse --verify refs/tags/<NEW_TAG>`.
5. Ask for confirmation if `NEW_TAG` is an RC (`-rc`), is already contained in `release`, or is older than `OLD_TAG`.

## Step 3: Pre-analysis (read-only)

1. `git diff --stat refs/tags/<OLD_TAG> refs/tags/<NEW_TAG> | tail -5`
2. Moved or deleted files: `git diff --name-status -M --diff-filter=DR refs/tags/<OLD_TAG> refs/tags/<NEW_TAG>`. Compare the paths with `customizations.md`. If a file containing custom code was moved or replaced (example from v0.8.7: `api/models/Agent.js` became `packages/api/src/agents/load.ts`), the custom code must be ported to the new file.
3. List separately and show to the developer: changes to `.env.example`, `librechat.yaml`, `Dockerfile*`, the Node version, and `version` in `package.json`.

## Step 4: Merge

```
git checkout -b merge/<NEW_TAG>-into-release origin/release
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

## Step 5: Customization check (gate before the PR)

1. Run `.claude/skills/upstream-merge/check.sh <NEW_TAG>` (it switches to the repo root itself). It checks everything in `customizations.md` (contents, files, branding). Exit code 0 is required.
2. Cross-check the file list: `git diff refs/tags/<NEW_TAG> HEAD --name-status`. Every file from `customizations.md` must appear; explain any unexpected new files.
3. Tests:
   - `cd packages/api && npx jest src/agents`
   - `cd packages/data-provider && npx jest parsers`

If anything fails: fix the cause on the merge branch (port the missing custom code) and rerun the check. If that does not succeed, **do not open a PR** and report to the developer exactly what is missing.

If the developer names a new customization, add it to `customizations.md`.

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

1. `git push -u origin merge/<NEW_TAG>-into-release`
2. `gh pr create -R poeppelmann/MIA-LibreChat --draft --base release --head merge/<NEW_TAG>-into-release --title "chore: merge <NEW_TAG> into release"`
3. PR body: write it in English and follow `.github/pull_request_template.md` (sections `Summary`, `Change Type`, `Testing` with `Test Configuration`, `Checklist`). Delete irrelevant options and tick only what is true.
   - `Summary`: chosen tag and `OLD_TAG`, resolved conflicts, moved files, notes from Step 3 (.env, config, Node, version)
   - `Change Type`: tick "New feature" (upstream upgrade, non-breaking) or "Breaking change" if Step 3 found incompatible config/env changes
   - `Testing`: result of `check.sh` (summary line) and of the tests, plus the manual test list: login, chat with streaming, "Image generation" button produces an image, `{{conversation_id}}` is replaced, branding, new env variables set in the target system
   - Mandatory note in `Summary`: "Merging into `release` triggers the ACR build and overwrites the image tag `mia:<version>`. Merge only by the developer. Note the rollback tag/digest first."
   - Ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
4. Show `gh pr checks <nr>` once. Do not wait for the merge and do not change anything else on the PR.

## Step 8: Handover

Report briefly: PR link (draft), check result, open points, manual test list. Note: after the merge, watch the build with `gh run list --workflow acr-build-and-push-libre-chat.yml --limit 1` and pull the image again in the target system.
