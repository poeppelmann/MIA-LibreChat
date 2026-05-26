# Branch Status — feat/orchestrator-designer

**Letztes Update:** 2026-05-26 (Phase 1 von 3 abgeschlossen)
**Basis:** lokal main @ `991636e41` (190 Commits hinter origin/main, bewusst nicht aktualisiert)
**Stash:** `stash@{0}: On main: local-docker-sap-bp` (lokale Docker-Customizings: sap-businesspartner Service, RKdocker-compose.override.yml — NICHT Teil dieses Branches)

## Idee

Visueller Designer für **Agent-Orchestratoren** mit Sub-Agents:

- Canvas zeigt 1 Orchestrator oben + N Sub-Agents darunter, verbunden mit Handoff-Edges
- Form-Panel pro Node (Name, Provider, Modell, System-Prompt, Modellparameter, MCP-Server, Capabilities, Handoff-Beschreibung/-Prompt)
- JSON-Preview mit Monaco-Editor (Live-Validation, Apply-Back-to-Canvas)
- Test-Case-Loader: Außendienst-Demo + IT-HelpDesk-Demo (Jira/Confluence/Power-Automate)
- Speichern über bestehende LibreChat-API (`POST /api/agents` für jeden Sub-Agent, `POST /api/agents` für Orchestrator mit `edges`)
- Route `/admin/orchestrator-designer`, Admin-only

## Stand

Alle Komponenten + Initial-Fixes umgesetzt und TypeScript-sauber:

```
client/src/components/OrchestratorDesigner/
├── index.tsx
├── OrchestratorDesigner.tsx       — Haupt-Canvas + Layout
├── OrchestratorNode.tsx           — xyflow custom node
├── SubAgentNode.tsx               — xyflow custom node
├── AgentConfigPanel.tsx           — Form-Panel (Provider/Modell/MCP-Picker/Handoff-Felder)
├── JsonPreviewPanel.tsx           — Monaco JSON-Editor, Theme dynamisch
├── DesignerToolbar.tsx            — Save/Export/Import/Reset/Test-Cases/Limit-Anzeige
├── useOrchestratorStore.ts        — React-State-Hook, MAX_SUB_AGENTS = 10
├── useAgentApi.ts                 — saveDesign() Flow + MCP-Expansion + Provider/Modell-Listen
├── orchestratorSchema.ts          — Zod-Schemas
├── types.ts                       — TS-Typen
└── testCases/
    ├── aussendienstOrchestrator.json   — Alle Sub-Agents auf claude-haiku-4-5
    └── itHelpdeskOrchestrator.json     — Alle Sub-Agents auf claude-haiku-4-5
```

Zusätzliche Änderungen außerhalb:

- `client/src/routes/index.tsx` — Route `admin/orchestrator-designer` registriert
- `client/src/routes/OrchestratorDesignerRoute.tsx` — Admin-Gate + lazy import
- `client/src/components/Nav/AccountSettings.tsx` — Menüpunkt im Account-Dropdown (Admins)
- `client/src/components/SidePanel/Agents/Advanced/AdvancedPanel.tsx` — "Visueller Orchestrator-Designer"-Button am Ende der Erweiterten Einstellungen (Admins)
- `client/package.json` — `@xyflow/react ^12.10.2` als einzige neue Dependency

## Umgesetzte Fixes nach erstem Test (in dieser Reihenfolge committen-bereit, noch nicht commited)

1. **Designer-Link** im AgentBuilder unter Erweiterte Einstellungen (Admin-only)
2. **Edges sauber**: `agent_ids` wird nicht mehr gesetzt → AgentChain-Panel bleibt leer. Edges enthalten `description` + `prompt` aus neuen Sub-Agent-Feldern `handoffDescription`/`handoffPrompt`
3. **Provider+Modell**: 2-stufige Auswahl wie im Original AgentBuilder, gespeist aus `useGetEndpointsQuery` + `useGetModelsQuery`
4. **Theming**: alle Inputs `bg-surface-tertiary text-text-primary placeholder:text-text-tertiary`; Monaco-Editor Theme via `ThemeContext` + `isDark()`
5. **MCP-only**: External-Connections und freie Tools-Liste raus. Stattdessen Checkbox-Liste der MCP-Server aus `useMCPServerManager` (deckt YAML *und* DB-konfigurierte Server ab — User pflegt im UI). Beim Save werden Tool-IDs automatisch aus den gewählten Servern expandiert
6. **Max 10 Sub-Agents** — Limit überall durchgesetzt (Add-Button disabled, Import gekappt, Counter im Toolbar)
7. **Demo-Modelle**: Alle Sub-Agents in beiden Test-Cases auf `claude-haiku-4-5`

## Phase 1 (2026-05-26): UX-Erweiterungen umgesetzt

Auf Basis der 11 User-Anforderungen am 2026-05-26 wurde der Phasenplan vereinbart (siehe memory `project-orchestrator-phase-plan`). Phase 1 enthält fünf Punkte:

### Neue/geänderte Dateien

```
client/src/components/OrchestratorDesigner/
├── AgentSettingsForm.tsx       (NEU — pure form-body, props-driven, variant 'side'|'inline')
├── DesignerContext.tsx         (NEU — editMode + designerweite Daten/Aktionen für Custom-Nodes)
├── HandoffEdge.tsx             (NEU — xyflow custom edge mit Label-Chip + Inline-Editor)
├── handoffSuggestion.ts        (NEU — lokale Heuristik bis echter LLM-Endpoint kommt)
├── LoadOrchestratorMenu.tsx    (NEU — OGDialog-Liste bestehender Orchestratoren)
├── useOrchestratorLibrary.ts   (NEU — listAgents + Filter edges>0 + reverse-mapping)
├── AgentConfigPanel.tsx        (refactored — nur noch Side-Wrapper um AgentSettingsForm)
├── OrchestratorNode.tsx        (modified — NodeToolbar mit Form im Inline-Modus)
├── SubAgentNode.tsx            (modified — NodeToolbar mit Form + Delete im Inline-Modus)
├── OrchestratorDesigner.tsx    (modified — editMode-State, DesignerContextProvider, edgeTypes)
├── DesignerToolbar.tsx         (modified — Inline/Leiste-Toggle, LoadOrchestratorMenu integriert)
└── useAgentApi.ts              (modified — DesignerMcpServer.iconPath ergänzt)
```

### Umgesetzte Punkte (1, 4, 5, 7, 11 aus User-Liste)

1. **Inline-Settings unter Node** — Default-Modus. Toolbar-Toggle „Inline/Leiste" wechselt zur klassischen Side-Panel-Variante. Im Inline-Modus rendert die selektierte Node via xyflow `NodeToolbar` die volle Form direkt am Node (Orchestrator rechts, Sub-Agent unten). `AgentSettingsForm` ist gesplittet, Side-Panel benutzt dieselbe Komponente.
4. **Handoff-Texte an Verbindungslinien** — Custom `HandoffEdge` mit Chip-Label (zeigt erste 60 Zeichen der Beschreibung oder Placeholder). Klick expandiert Inline-Editor mit `handoffDescription` + `handoffPrompt`. Updates fließen bidirektional über `DesignerContext.updateSubAgent`.
5. **KI-Knopf „Handoff aus Prompt"** — **Re-Scoped als Stub**: lokale Heuristik (`handoffSuggestion.ts`) extrahiert ersten substanziellen Satz aus dem System-Prompt und rahmt ihn als „Delegiere an X, wenn …" um. Button erscheint sowohl im Form-Handoff-Block als auch im Edge-Popover. Echter LLM-Call kommt mit Phase 2 (Wizard braucht eh einen Backend-Endpoint, dann gemeinsam gebaut). User wurde nach Phase 1 darüber informiert.
7. **MCP-Server-Look angeglichen** — Items nutzen jetzt LibreChat-Stil (`rounded-lg p-1 hover:bg-surface-primary-alt`, Icon-Avatar mit `iconPath` aus MCP-Config, Tool-Count als Badge).
11. **Bestehende Orchestratoren laden** — `useOrchestratorLibrary` filtert `dataService.listAgents` (Permission `VIEW`) auf Agents mit `edges.length > 0`, lädt Orchestrator + referenzierte Sub-Agents nach, mapped Reverse auf `OrchestratorDesign` (inkl. MCP-Server-Extraktion aus Tool-IDs via `Constants.mcp_delimiter`). UI: `OGDialog`-basiertes `LoadOrchestratorMenu` neben Export/Import.

### TypeScript-Status

`npx tsc --noEmit -p tsconfig.json` aus `/client` zeigt keine Fehler in den OrchestratorDesigner-Files. Vorbestehende Fehler aus Test-Dateien und unrelated Components blieben unangetastet.

### Offene Phasen

- **Phase 2** (Punkte 2, 8, 10): Vollbild-Editor pro Agent mit KI-Buttons (Kürzer/Sachlicher/Kritischer/Stil), Test-Run gegen ephemeral Conversation, MCP-Auto-Tool-Vorschlag (Opus), Interview-Wizard (Opus). Helfer-Modell hybrid (Haiku/Opus). **Phase 2 baut den Backend-LLM-Endpoint**, der dann auch Phase 1.3 (KI-Handoff) richtig erfüllt.
- **Phase 3** (Punkte 6, 9): Skills — Recherche zeigt, dass LibreChat **kein** formales Skills-Konzept hat, nur `AgentCapabilities`. Vor Phase 3 muss User klären, ob Capabilities oder neues Datenmodell gemeint sind. Siehe Memory `project-orchestrator-skills-research`.
- **Backlog**: Langfuse-Anbindung (Punkt 3, bewusst zurückgestellt, Memory `project-orchestrator-langfuse-backlog`).

## Noch offen (Phase 2/3, Docker-Build)

### Sofort als Nächstes: lokaler Docker-Build

Aktueller Zustand:

- `docker-compose.yml` ist modifiziert (NICHT gestashed, ist im Working Tree): `image: mia:builder` statt Public-Image
- Image `mia:builder` existiert bereits (`docker images mia:builder` → 083c116a4fff, 3.51GB) — aber das ist vom letzten Build, enthält die Designer-Änderungen vermutlich **nicht**
- **Wichtiger fehlender Schritt**: In `docker-compose.yml` fehlt der `build:`-Block. Ohne den versucht Compose das Image zu pullen statt zu bauen. Optionen:
  - **(A)** Vorab `docker build -t mia:builder .` ausführen, dann `docker compose up -d`
  - **(B)** In `docker-compose.yml` einen `build: { context: ., dockerfile: Dockerfile }`-Block ergänzen, dann `docker compose up -d --build`
- Multi-stage Dockerfile vorhanden, baut Backend + Frontend in einen Container, `CMD ["npm", "run", "backend"]`, Port 3080
- Achtung: Im Stash@{0} liegen die SAP-BP- und Admin-Panel-Customizings, die du sonst nutzt — wir hatten sie ausgeklammert, um den Branch sauber zu halten. Vor Compose-Up entscheiden: stash poppen oder ohne hochziehen?

### Sonstiges

- Branch ist **uncommitted** — alles im Working Tree. Vor Commit: ggf. dirty `docker-compose.yml`-Änderung NICHT mit committen (gehört nicht zum Feature)
- Lokales `main` ist 190 Commits hinter origin/main — Merge-Konflikte erwartbar wenn man später rebased
- TypeScript-Check sauber für alle neuen Files. **Vorbestehender** Fehler in `client/src/components/Nav/AccountSettings.tsx:57` (ariakit Menu typing) — NICHT durch diesen Branch verursacht, verifiziert per stash/restore
- i18n: deutsche Strings sind aktuell hardcoded im Designer (`com_orchdesigner_*` Keys nicht angelegt). CLAUDE.md verlangt eigentlich `useLocalize()` — als Cleanup-Task vor Production
- ESLint nicht separat ausgeführt
- Test-Cases laden `mcpServers`-Feld noch nicht (legacy `tools`-Arrays bleiben drin für JSON-Round-Trip); im UI werden tools-Strings aus den JSONs ignoriert, User muss MCP-Server nach Import manuell ankreuzen

## Entscheidungen / Erkenntnisse (warum etwas so gebaut ist)

- **PATCH statt PUT** für Agent-Update (LibreChat-Realität, im Original-Prompt stand PUT)
- **Edges statt agent_ids**: `edges` ist das aktuelle Handoff-System (`agent_ids` deprecated). Wir setzen nur `edges`, sonst landet der gleiche Agent auch in der AgentChain-Liste
- **Kein Zustand-Lib**: Designer-State ist lokal → React `useState`. Constraint "keine neuen UI-Libraries" bewusst respektiert (`zustand` aus dem Original-Prompt verworfen)
- **MCP-Server-Datenquelle**: `useMCPServerManager` → `/api/mcp/servers` → liefert **YAML + DB-konfigurierte Server**, also genau das, was im UI-MCP-Bereich gepflegt wird
- **`as unknown as AgentCreateParams`-Cast** an einer Stelle in `useAgentApi.ts` bewusst, weil das LibreChat-Backend `model_parameters` flexibel als `z.record(z.unknown())` validiert, der shared TS-Type aber historisch strikt ist (kein `max_tokens`)
- **Provider-Inferenz**: Falls JSON nur `model` enthält (kein `provider`), wird per `modelsConfig` durchsucht; Fallback nach Modell-Präfix (`claude*` → anthropic, `gpt*` → openAI)

## Nicht-triviale Stellen falls jemand reinliest

- `useAgentApi.ts:expandMcpServersToTools()` — expandiert `agent.mcpServers` über `mcpServersMap` zu Tool-IDs beim Save
- `useAgentApi.ts:saveDesign()` — sequentieller Save: erst alle Sub-Agents (sammelt agent_id + handoff-meta), dann Orchestrator mit `edges`
- `OrchestratorDesigner.tsx` onChange-Handler — strippt Sub-Agent-spezifische Felder (`handoffDescription`, `handoffPrompt`, `isOrchestrator`) beim Patch des Orchestrators raus, damit der Type-Check passt
