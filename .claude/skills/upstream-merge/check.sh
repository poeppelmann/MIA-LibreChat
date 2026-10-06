#!/usr/bin/env bash
# Verifies that all customizations from customizations.md are preserved in the working tree.
# Usage: check.sh <upstream-tag>   (e.g. v0.8.8)
set -u

TAG="${1:?usage: check.sh <upstream-tag>}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="$DIR/customizations.md"
cd "$(git rev-parse --show-toplevel)" || exit 2
REF="refs/tags/$TAG"

git rev-parse --verify --quiet "$REF" >/dev/null || { echo "Tag $REF not found"; exit 2; }

fail=0
ok=0

report_fail() { echo "FAIL $1"; fail=$((fail + 1)); }
report_ok() { ok=$((ok + 1)); }

while IFS= read -r line; do
  case "$line" in
    contains\ *)
      rest="${line#contains }"
      path="${rest%% :: *}"
      text="${rest#* :: }"
      if [ ! -f "$path" ]; then report_fail "$path is missing (expected: $text)"
      elif grep -qF -- "$text" "$path"; then report_ok
      else report_fail "$path does not contain: $text"; fi
      ;;
    exists\ *)
      path="${line#exists }"
      if [ -f "$path" ]; then report_ok; else report_fail "$path is missing"; fi
      ;;
    differs\ *)
      path="${line#differs }"
      if [ ! -f "$path" ]; then report_fail "$path is missing (branding)"
      elif git diff --quiet "$REF" -- "$path"; then report_fail "$path is identical to $TAG (branding lost)"
      else report_ok; fi
      ;;
  esac
done < <(awk '/^```manifest$/{p=1;next} /^```$/{p=0} p && NF && $1 !~ /^#/' "$MANIFEST")

echo "Customization check against $TAG: $ok ok, $fail failed"
[ "$fail" -eq 0 ]
