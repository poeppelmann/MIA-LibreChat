---
name: upstream-merge
description: Merged einen vom Entwickler gewählten Upstream-Release-Tag (danny-avila/LibreChat) in den release-Branch, prüft die MIA-Customizations und öffnet einen Draft-PR. Verwenden bei "neue LibreChat-Version einspielen", "Upstream-Release in release mergen", "Upstream-Update".
disable-model-invocation: true
---

# Upstream-Release in `release` mergen

Führt den gesamten Ablauf bis zum Draft-PR durch. Der PR wird nie vom Agenten gemerged. Ein Merge nach `release` löst den ACR-Build aus (`.github/workflows/acr-build-and-push-libre-chat.yml`) und überschreibt das Image-Tag `mia:<package.json-version>`.

## Harte Regeln

- **Nie selbst einen Tag wählen**, nie einen Tag als Default oder "Recommended" kennzeichnen. Der Entwickler entscheidet.
- **Nie** `gh pr merge`, **nie** auf `release` pushen, **nie** `--force`.
- PR **nur mit `--draft`**, nie auf "ready for review" setzen.
- **Kein PR**, solange `check.sh` oder die Tests fehlschlagen.
- Konflikte **nie pauschal** mit `--ours`/`--theirs` lösen.
- Tags immer als `refs/tags/<tag>` ansprechen (lokale Branches wie `v0.8.7` machen den Namen mehrdeutig).
- `main` und `mia-dev` sind nicht Teil dieses Ablaufs.

## Schritt 1: Voraussetzungen

1. `git status --porcelain` muss leer sein, sonst abbrechen und melden.
2. `git remote get-url upstream` muss `danny-avila/LibreChat` enthalten, `origin` muss `poeppelmann/MIA-LibreChat` sein. Sonst abbrechen.
3. `git fetch origin` und `git fetch upstream --tags`.

## Schritt 2: Tag-Auswahl

1. Die letzten 10 Upstream-Tags nach Datum:
   `git tag --list 'v*' --sort=-creatordate | head -10`
   (nicht `-v:refname`, das sortiert finale Versionen hinter die RCs).
2. Zuletzt in `release` gemergten Tag bestimmen (`OLD_TAG`):
   `git tag --merged origin/release --list 'v*' --sort=-creatordate | head -1`.
   Tags, die bereits in `release` enthalten sind, in der Liste kennzeichnen.
3. Mit `AskUserQuestion` dem Entwickler vorlegen. Die vollständige Liste der 10 Tags (mit Datum und Markierung) steht im Fragetext. Weil höchstens 4 Optionen möglich sind, die 4 neuesten als Optionen anbieten, jeden anderen der 10 über "Other". Keine Option als empfohlen markieren. Ohne Antwort nicht fortfahren.
4. Wahl prüfen: `git rev-parse --verify refs/tags/<NEW_TAG>`.
5. Nachfragen, wenn `NEW_TAG` ein RC (`-rc`) ist, bereits in `release` enthalten oder älter als `OLD_TAG`.

## Schritt 3: Vorab-Analyse (nur lesen)

1. `git diff --stat refs/tags/<OLD_TAG> refs/tags/<NEW_TAG> | tail -5`
2. Verschobene oder gelöschte Dateien: `git diff --name-status -M --diff-filter=DR refs/tags/<OLD_TAG> refs/tags/<NEW_TAG>`. Mit den Pfaden in `customizations.md` abgleichen. Wurde eine Datei mit Custom-Code verschoben oder ersetzt (Beispiel aus v0.8.7: `api/models/Agent.js` wurde zu `packages/api/src/agents/load.ts`), muss der Custom-Code in die neue Datei übertragen werden.
3. Separat auflisten und dem Entwickler zeigen: Änderungen an `.env.example`, `librechat.yaml`, `Dockerfile*`, Node-Version und `version` in `package.json`.

## Schritt 4: Merge

```
git checkout -b merge/<NEW_TAG>-into-release origin/release
git merge refs/tags/<NEW_TAG>
```

Kein `--squash`. Bei Konflikten (`git diff --name-only --diff-filter=U`):

- Pro Datei beide Seiten lesen. Upstream-Struktur übernehmen und den MIA-Custom-Block darauf neu aufsetzen.
- `package-lock.json`: Upstream-Version nehmen, danach `npm install` und den Diff prüfen.
- Ändern Custom und Upstream dieselbe Logik und ist die Auflösung nicht eindeutig: Entwickler fragen.

Merge-Commit-Message: `Merge tag '<NEW_TAG>' into release`, danach die Liste der Konflikte und wie sie gelöst wurden. Commit-Attribution laut Systemhinweis.

## Schritt 5: Customization-Check (Gate vor dem PR)

1. `.claude/skills/upstream-merge/check.sh <NEW_TAG>` im Repo-Root ausführen. Es prüft alles aus `customizations.md` (Inhalte, Dateien, Branding). Exit-Code 0 ist Pflicht.
2. Dateiliste gegenprüfen: `git diff refs/tags/<NEW_TAG> HEAD --name-status`. Jede Datei aus `customizations.md` muss auftauchen, unerwartete neue Dateien erklären.
3. Tests:
   - `cd packages/api && npx jest src/agents`
   - `cd packages/data-provider && npx jest parsers`

Schlägt etwas fehl: Ursache am Merge-Branch beheben (fehlenden Custom-Code portieren), Check wiederholen. Gelingt es nicht, **keinen PR öffnen** und dem Entwickler genau berichten, was fehlt.

Nennt der Entwickler eine neue Customization, in `customizations.md` ergänzen.

## Schritt 6: Build und Tests

```
npm run smart-reinstall
npm run build
cd packages/api && npx jest
cd ../../api && npx jest
cd ../packages/api && npx tsc --noEmit
```

Fehler zuerst auf Merge-Ursachen prüfen (Custom-Code gegen neue Upstream-API). Tests nicht abschwächen. Ist ein Fehler offensichtlich upstream-seitig, im PR vermerken.

## Schritt 7: Draft-PR

1. `git push -u origin merge/<NEW_TAG>-into-release`
2. `gh pr create -R poeppelmann/MIA-LibreChat --draft --base release --head merge/<NEW_TAG>-into-release --title "chore: merge <NEW_TAG> into release"`
3. PR-Text:
   - Gewählter Tag und `OLD_TAG`
   - Gelöste Konflikte und verschobene Dateien
   - Ergebnis `check.sh` (Zählerzeile) und der Tests
   - Hinweise aus Schritt 3 (.env, Config, Node, Version)
   - Manuelle Testliste: Login, Chat mit Streaming, Button "Bildgenerierung" erzeugt ein Bild, `{{conversation_id}}` wird ersetzt, Branding, neue Env-Variablen im Zielsystem gesetzt
   - Pflicht-Hinweis: "Ein Merge nach `release` löst den ACR-Build aus und überschreibt das Image-Tag `mia:<version>`. Merge nur durch den Entwickler. Vorher Rollback-Tag/Digest notieren."
   - Endet mit `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
4. Einmal `gh pr checks <nr>` anzeigen. Nicht auf den Merge warten und nichts weiter am PR ändern.

## Schritt 8: Übergabe

Kurz berichten: PR-Link (Draft), Check-Ergebnis, offene Punkte, manuelle Testliste. Hinweis: Nach dem Merge den Build mit `gh run list --workflow acr-build-and-push-libre-chat.yml --limit 1` beobachten und das Image im Zielsystem neu ziehen.
