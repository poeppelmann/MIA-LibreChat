import React, { useEffect, useMemo } from 'react';
import { Server, Sparkles } from 'lucide-react';
import { Input, Textarea, Label, Checkbox, Button } from '@librechat/client';
import { alternateName } from 'librechat-data-provider';
import { suggestHandoffDescription } from './handoffSuggestion';
import type { DesignerMcpServer } from './useAgentApi';
import type {
  DesignerOrchestrator,
  DesignerSubAgent,
  ModelParameters,
} from './types';

export type SettingsFormVariant = 'side' | 'inline';

interface AgentSettingsFormProps {
  agent: DesignerOrchestrator | DesignerSubAgent;
  isOrchestrator: boolean;
  providers: string[];
  getModelsForProvider: (provider: string) => string[];
  mcpServers: DesignerMcpServer[];
  onChange: (patch: Partial<DesignerSubAgent>) => void;
  variant?: SettingsFormVariant;
}

type ModelParameterKey =
  | 'temperature'
  | 'max_tokens'
  | 'top_p'
  | 'frequency_penalty'
  | 'presence_penalty';

const NUMBER_FIELDS: Array<{
  key: ModelParameterKey;
  label: string;
  min: number;
  max: number;
  step: number;
}> = [
  { key: 'temperature', label: 'Temperature', min: 0, max: 2, step: 0.1 },
  { key: 'max_tokens', label: 'Max tokens', min: 1, max: 200000, step: 1 },
  { key: 'top_p', label: 'Top P', min: 0, max: 1, step: 0.05 },
  { key: 'frequency_penalty', label: 'Frequency penalty', min: -2, max: 2, step: 0.1 },
  { key: 'presence_penalty', label: 'Presence penalty', min: -2, max: 2, step: 0.1 },
];

const inputClass =
  'h-9 bg-surface-tertiary text-text-primary placeholder:text-text-tertiary';
const inputClassXs =
  'h-8 text-xs bg-surface-tertiary text-text-primary placeholder:text-text-tertiary';
const textareaClass =
  'bg-surface-tertiary text-text-primary placeholder:text-text-tertiary';
const selectClass =
  'flex h-9 w-full rounded-lg border border-border-light bg-surface-tertiary px-3 py-2 text-sm text-text-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

const AgentSettingsForm: React.FC<AgentSettingsFormProps> = ({
  agent,
  isOrchestrator,
  providers,
  getModelsForProvider,
  mcpServers,
  onChange,
  variant = 'side',
}) => {
  const providerValue = agent.provider ?? '';
  const modelsForProvider = useMemo(
    () => (providerValue ? getModelsForProvider(providerValue) : []),
    [providerValue, getModelsForProvider],
  );

  useEffect(() => {
    if (providerValue && agent.model && modelsForProvider.length > 0) {
      if (!modelsForProvider.includes(agent.model)) {
        onChange({ model: modelsForProvider[0] ?? '' });
      }
    }
  }, [providerValue, agent.model, modelsForProvider, onChange]);

  const selectedMcpServers = useMemo(
    () => new Set(agent.mcpServers ?? []),
    [agent.mcpServers],
  );

  const toggleMcpServer = (serverName: string) => {
    const next = new Set(selectedMcpServers);
    if (next.has(serverName)) {
      next.delete(serverName);
    } else {
      next.add(serverName);
    }
    onChange({ mcpServers: Array.from(next) });
  };

  const updateModelParameter = (key: ModelParameterKey, raw: string) => {
    const next: ModelParameters = { ...agent.modelParameters };
    if (raw === '') {
      delete next[key];
    } else {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed)) {
        next[key] = parsed;
      }
    }
    onChange({ modelParameters: next });
  };

  const isSubAgent = !isOrchestrator;
  const subAgent = isSubAgent ? (agent as DesignerSubAgent) : null;

  const promptMinHeight = variant === 'inline' ? 'min-h-[80px]' : 'min-h-[120px]';
  const descriptionMinHeight = variant === 'inline' ? 'min-h-[48px]' : 'min-h-[60px]';

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-xs text-text-secondary">Name *</Label>
        <Input
          value={agent.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-text-secondary">Provider *</Label>
          <select
            value={providerValue}
            onChange={(e) => onChange({ provider: e.target.value, model: '' })}
            className={selectClass}
          >
            <option value="">— wählen —</option>
            {providers.map((provider) => (
              <option key={provider} value={provider}>
                {alternateName[provider] ?? provider}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-text-secondary">Model *</Label>
          <select
            value={agent.model}
            onChange={(e) => onChange({ model: e.target.value })}
            className={selectClass}
            disabled={!providerValue}
          >
            <option value="">{providerValue ? '— wählen —' : '— Provider zuerst —'}</option>
            {modelsForProvider.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-text-secondary">System Prompt</Label>
        <Textarea
          value={agent.systemPrompt}
          onChange={(e) => onChange({ systemPrompt: e.target.value })}
          className={`${promptMinHeight} ${textareaClass}`}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-text-secondary">
          Beschreibung {isOrchestrator ? '' : '(intern, nicht für Übergabe)'}
        </Label>
        <Textarea
          value={agent.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className={`${descriptionMinHeight} ${textareaClass}`}
        />
      </div>

      {subAgent ? (
        <fieldset className="space-y-2 rounded-md border border-amber-400/50 bg-amber-50/30 p-3 dark:bg-amber-900/10">
          <legend className="px-1 text-xs font-medium text-amber-700 dark:text-amber-300">
            Handoff (Orchestrator → Sub-Agent)
          </legend>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs text-text-secondary">
                Handoff-Beschreibung
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
                onClick={() =>
                  onChange({ handoffDescription: suggestHandoffDescription(subAgent) })
                }
                title="Aus System-Prompt vorschlagen (lokale Heuristik — KI in Phase 2)"
              >
                <Sparkles className="mr-1 size-3" /> aus Prompt
              </Button>
            </div>
            <Textarea
              value={subAgent.handoffDescription ?? ''}
              placeholder="Wann soll der Orchestrator zu diesem Sub-Agent delegieren? (z. B. ‚für Fragen aus der Confluence-Wissensbasis‘)"
              onChange={(e) => onChange({ handoffDescription: e.target.value })}
              className={`${descriptionMinHeight} ${textareaClass}`}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-text-secondary">
              Handoff-Prompt (optional)
            </Label>
            <Textarea
              value={subAgent.handoffPrompt ?? ''}
              placeholder="Anweisung, die mit dem Handoff übergeben wird. Leer = Default."
              onChange={(e) => onChange({ handoffPrompt: e.target.value })}
              className={`${descriptionMinHeight} ${textareaClass}`}
            />
          </div>
        </fieldset>
      ) : null}

      <fieldset className="space-y-2 rounded-md border border-border-light p-3">
        <legend className="px-1 text-xs font-medium text-text-secondary">
          Modellparameter
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {NUMBER_FIELDS.map(({ key, label, min, max, step }) => (
            <div key={key} className="space-y-1">
              <Label className="text-[11px] text-text-secondary">{label}</Label>
              <Input
                type="number"
                min={min}
                max={max}
                step={step}
                value={(agent.modelParameters[key] as number | undefined) ?? ''}
                onChange={(e) => updateModelParameter(key, e.target.value)}
                className={inputClassXs}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2 rounded-md border border-border-light p-3">
        <legend className="px-1 text-xs font-medium text-text-secondary">
          MCP-Server
        </legend>
        {mcpServers.length === 0 ? (
          <div className="text-xs text-text-tertiary">
            Keine MCP-Server verfügbar. Lege sie im LibreChat <span className="font-medium">MCP-Bereich</span>{' '}
            an (oder konfiguriere sie in <span className="font-mono">librechat.yaml</span>).
          </div>
        ) : (
          <div className="space-y-0.5">
            {mcpServers.map((server) => {
              const checked = selectedMcpServers.has(server.serverName);
              return (
                <label
                  key={server.serverName}
                  className="flex cursor-pointer items-center gap-2 rounded-lg p-1 text-sm transition-colors hover:bg-surface-primary-alt"
                >
                  <Checkbox
                    aria-label={`Toggle MCP server ${server.title ?? server.serverName}`}
                    checked={checked}
                    onCheckedChange={() => toggleMcpServer(server.serverName)}
                    className="h-4 w-4 rounded border border-border-medium transition-all duration-200 hover:border-border-heavy"
                  />
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full">
                    {server.iconPath ? (
                      <div
                        className="h-6 w-6 rounded-full bg-center bg-no-repeat dark:bg-white/20"
                        style={{
                          backgroundImage: `url(${server.iconPath})`,
                          backgroundSize: 'cover',
                        }}
                      />
                    ) : (
                      <Server className="size-4 text-text-tertiary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate text-text-primary"
                      title={server.title ?? server.serverName}
                    >
                      {server.title ?? server.serverName}
                    </div>
                    {server.description ? (
                      <div className="line-clamp-1 text-[11px] text-text-secondary">
                        {server.description}
                      </div>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded-md bg-surface-secondary px-1.5 py-0.5 text-[10px] font-medium text-text-tertiary">
                    {server.toolIds.length} Tool{server.toolIds.length === 1 ? '' : 's'}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </fieldset>

      {agent.agent_id ? (
        <div className="rounded-md bg-surface-secondary p-2 text-[11px] text-text-tertiary">
          Verknüpft mit Agent-ID: <span className="font-mono">{agent.agent_id}</span>
        </div>
      ) : null}
    </div>
  );
};

export default AgentSettingsForm;
