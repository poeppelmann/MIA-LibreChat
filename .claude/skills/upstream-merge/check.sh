#!/usr/bin/env bash
# Prüft, dass alle Customizations aus customizations.md im Working Tree erhalten sind.
# Aufruf im Repo-Root: check.sh <upstream-tag>   (z. B. v0.8.8)
set -u

TAG="${1:?usage: check.sh <upstream-tag>}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="$DIR/customizations.md"
REF="refs/tags/$TAG"

git rev-parse --verify --quiet "$REF" >/dev/null || { echo "Tag $REF nicht gefunden"; exit 2; }

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
      if [ ! -f "$path" ]; then report_fail "$path fehlt (erwartet: $text)"
      elif grep -qF -- "$text" "$path"; then report_ok
      else report_fail "$path enthält nicht: $text"; fi
      ;;
    exists\ *)
      path="${line#exists }"
      if [ -f "$path" ]; then report_ok; else report_fail "$path fehlt"; fi
      ;;
    differs\ *)
      path="${line#differs }"
      if [ ! -f "$path" ]; then report_fail "$path fehlt (Branding)"
      elif git diff --quiet "$REF" -- "$path"; then report_fail "$path ist identisch zu $TAG (Branding verloren)"
      else report_ok; fi
      ;;
  esac
done < <(awk '/^```manifest$/{p=1;next} /^```$/{p=0} p && NF && $1 !~ /^#/' "$MANIFEST")

echo "Customization-Check gegen $TAG: $ok ok, $fail fehlgeschlagen"
[ "$fail" -eq 0 ]
