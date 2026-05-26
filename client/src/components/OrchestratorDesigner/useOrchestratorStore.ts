import { useCallback, useMemo, useState } from 'react';
import { SCHEMA_VERSION } from './types';
import type {
  AgentSelection,
  DesignerOrchestrator,
  DesignerSubAgent,
  OrchestratorDesign,
} from './types';

export const MAX_SUB_AGENTS = 10;

const newId = (prefix: string): string =>
  `${prefix}-${typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)}`;

const createDefaultOrchestrator = (): DesignerOrchestrator => ({
  id: newId('orchestrator'),
  isOrchestrator: true,
  name: 'Neuer Orchestrator',
  model: '',
  systemPrompt:
    'Du bist der zentrale Koordinator. Analysiere die Anfrage und delegiere an den passenden Sub-Agenten.',
  description: '',
  modelParameters: { temperature: 0.3, max_tokens: 2000 },
  capabilities: ['handover'],
});

const createDefaultSubAgent = (index: number): DesignerSubAgent => ({
  id: newId('sub'),
  name: `Sub-Agent ${index}`,
  model: '',
  systemPrompt: '',
  description: '',
  modelParameters: { temperature: 0.4, max_tokens: 1500 },
});

export interface UseOrchestratorStore {
  orchestrator: DesignerOrchestrator;
  subAgents: DesignerSubAgent[];
  selection: AgentSelection;
  select: (selection: AgentSelection) => void;
  updateOrchestrator: (patch: Partial<DesignerOrchestrator>) => void;
  updateSubAgent: (id: string, patch: Partial<DesignerSubAgent>) => void;
  addSubAgent: () => void;
  removeSubAgent: (id: string) => void;
  reorderSubAgent: (id: string, direction: 'left' | 'right') => void;
  loadDesign: (design: OrchestratorDesign) => void;
  resetDesign: () => void;
  toDesign: () => OrchestratorDesign;
}

export function useOrchestratorStore(): UseOrchestratorStore {
  const [orchestrator, setOrchestrator] = useState<DesignerOrchestrator>(
    createDefaultOrchestrator,
  );
  const [subAgents, setSubAgents] = useState<DesignerSubAgent[]>([]);
  const [selection, setSelection] = useState<AgentSelection>({ kind: 'orchestrator' });

  const updateOrchestrator = useCallback((patch: Partial<DesignerOrchestrator>) => {
    setOrchestrator((prev) => ({ ...prev, ...patch, isOrchestrator: true }));
  }, []);

  const updateSubAgent = useCallback((id: string, patch: Partial<DesignerSubAgent>) => {
    setSubAgents((prev) => prev.map((agent) => (agent.id === id ? { ...agent, ...patch } : agent)));
  }, []);

  const addSubAgent = useCallback(() => {
    setSubAgents((prev) => {
      if (prev.length >= MAX_SUB_AGENTS) {
        return prev;
      }
      const next = createDefaultSubAgent(prev.length + 1);
      return [...prev, next];
    });
  }, []);

  const removeSubAgent = useCallback((id: string) => {
    setSubAgents((prev) => prev.filter((agent) => agent.id !== id));
    setSelection((prev) =>
      prev && prev.kind === 'subAgent' && prev.id === id ? { kind: 'orchestrator' } : prev,
    );
  }, []);

  const reorderSubAgent = useCallback((id: string, direction: 'left' | 'right') => {
    setSubAgents((prev) => {
      const index = prev.findIndex((agent) => agent.id === id);
      if (index === -1) {
        return prev;
      }
      const swapWith = direction === 'left' ? index - 1 : index + 1;
      if (swapWith < 0 || swapWith >= prev.length) {
        return prev;
      }
      const next = [...prev];
      [next[index], next[swapWith]] = [next[swapWith], next[index]];
      return next;
    });
  }, []);

  const loadDesign = useCallback((design: OrchestratorDesign) => {
    setOrchestrator({ ...design.orchestrator, isOrchestrator: true });
    setSubAgents(
      design.subAgents.slice(0, MAX_SUB_AGENTS).map((agent) => ({ ...agent })),
    );
    setSelection({ kind: 'orchestrator' });
  }, []);

  const resetDesign = useCallback(() => {
    setOrchestrator(createDefaultOrchestrator());
    setSubAgents([]);
    setSelection({ kind: 'orchestrator' });
  }, []);

  const toDesign = useCallback((): OrchestratorDesign => {
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      orchestrator,
      subAgents,
    };
  }, [orchestrator, subAgents]);

  return useMemo(
    () => ({
      orchestrator,
      subAgents,
      selection,
      select: setSelection,
      updateOrchestrator,
      updateSubAgent,
      addSubAgent,
      removeSubAgent,
      reorderSubAgent,
      loadDesign,
      resetDesign,
      toDesign,
    }),
    [
      orchestrator,
      subAgents,
      selection,
      updateOrchestrator,
      updateSubAgent,
      addSubAgent,
      removeSubAgent,
      reorderSubAgent,
      loadDesign,
      resetDesign,
      toDesign,
    ],
  );
}
