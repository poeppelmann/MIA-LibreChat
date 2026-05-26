import React from 'react';
import {
  Handle,
  Position,
  NodeToolbar,
  type NodeProps,
} from '@xyflow/react';
import { Workflow, Cpu } from 'lucide-react';
import AgentSettingsForm from './AgentSettingsForm';
import { useDesignerContext } from './DesignerContext';
import type { DesignerNode, DesignerOrchestrator, DesignerSubAgent } from './types';

const OrchestratorNode: React.FC<NodeProps<DesignerNode>> = ({ data }) => {
  const { agent, selected } = data;
  const ctx = useDesignerContext();
  const subAgentCount = agent.tools?.length ?? 0;
  const showInlineForm = ctx.editMode === 'inline' && selected;

  return (
    <>
      <div
        className={`min-w-[240px] max-w-[320px] rounded-xl border-2 bg-surface-primary shadow-md transition-all ${
          selected
            ? 'border-blue-500 ring-2 ring-blue-300'
            : 'border-amber-400 hover:border-amber-500'
        }`}
        data-testid="orchestrator-node"
      >
        <div className="flex items-center gap-2 rounded-t-lg bg-amber-100 px-3 py-2 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          <Workflow className="size-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">Orchestrator</span>
        </div>
        <div className="space-y-2 p-3">
          <div className="truncate text-sm font-semibold text-text-primary" title={agent.name}>
            {agent.name || 'Unbenannt'}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <Cpu className="size-3" />
            <span className="truncate" title={agent.model}>
              {agent.model || 'Kein Modell'}
            </span>
          </div>
          {agent.description ? (
            <div
              className="line-clamp-2 text-xs text-text-secondary"
              title={agent.description}
            >
              {agent.description}
            </div>
          ) : null}
          {subAgentCount > 0 ? (
            <div className="text-[10px] uppercase tracking-wide text-text-tertiary">
              {subAgentCount} Tool{subAgentCount === 1 ? '' : 's'}
            </div>
          ) : null}
        </div>
        <Handle type="source" position={Position.Bottom} className="!bg-amber-500" />
      </div>

      <NodeToolbar
        isVisible={showInlineForm}
        position={Position.Right}
        offset={16}
        align="start"
        className="nodrag"
      >
        <div className="w-[400px] max-h-[70vh] overflow-y-auto rounded-xl border border-border-light bg-surface-primary p-4 shadow-xl">
          <div className="mb-3">
            <div className="text-[10px] uppercase tracking-wider text-text-tertiary">
              Orchestrator
            </div>
            <div className="truncate text-sm font-semibold text-text-primary" title={agent.name}>
              {agent.name || 'Unbenannt'}
            </div>
          </div>
          <AgentSettingsForm
            agent={agent as DesignerOrchestrator}
            isOrchestrator
            providers={ctx.providers}
            getModelsForProvider={ctx.getModelsForProvider}
            mcpServers={ctx.mcpServers}
            onChange={(patch: Partial<DesignerSubAgent>) => {
              const { handoffDescription: _hd, handoffPrompt: _hp, isOrchestrator: _io, ...rest } = patch;
              ctx.updateOrchestrator(rest);
            }}
            variant="inline"
          />
        </div>
      </NodeToolbar>
    </>
  );
};

export default OrchestratorNode;
