import React from 'react';
import {
  Handle,
  Position,
  NodeToolbar,
  type NodeProps,
} from '@xyflow/react';
import { Bot, Cpu, Wrench, Cable, Trash2 } from 'lucide-react';
import { Button } from '@librechat/client';
import AgentSettingsForm from './AgentSettingsForm';
import { useDesignerContext } from './DesignerContext';
import type { DesignerNode, DesignerSubAgent } from './types';

const SubAgentNode: React.FC<NodeProps<DesignerNode>> = ({ data }) => {
  const { agent, selected } = data;
  const ctx = useDesignerContext();
  const toolCount = agent.tools?.length ?? 0;
  const mcpCount = agent.externalConnections?.mcpEndpoints?.length ?? 0;
  const hasConnections =
    Boolean(agent.externalConnections?.ragServerUrl) ||
    (agent.externalConnections?.knowledgeBaseIds?.length ?? 0) > 0 ||
    (agent.externalConnections?.knowledgeBaseSpaces?.length ?? 0) > 0 ||
    mcpCount > 0 ||
    (agent.externalConnections?.customApiEndpoints?.length ?? 0) > 0;
  const showInlineForm = ctx.editMode === 'inline' && selected;

  return (
    <>
      <div
        className={`min-w-[200px] max-w-[260px] rounded-xl border-2 bg-surface-primary shadow-md transition-all ${
          selected
            ? 'border-blue-500 ring-2 ring-blue-300'
            : 'border-slate-300 hover:border-slate-400 dark:border-slate-600'
        }`}
        data-testid="sub-agent-node"
      >
        <Handle type="target" position={Position.Top} className="!bg-slate-400" />
        <div className="flex items-center gap-2 rounded-t-lg bg-slate-100 px-3 py-2 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <Bot className="size-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">Sub-Agent</span>
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
          <div className="flex flex-wrap gap-2 text-[10px] text-text-tertiary">
            {toolCount > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Wrench className="size-3" />
                {toolCount}
              </span>
            ) : null}
            {hasConnections ? (
              <span className="inline-flex items-center gap-1">
                <Cable className="size-3" />
                ext.
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <NodeToolbar
        isVisible={showInlineForm}
        position={Position.Bottom}
        offset={12}
        align="start"
        className="nodrag"
      >
        <div className="w-[380px] max-h-[70vh] overflow-y-auto rounded-xl border border-border-light bg-surface-primary p-4 shadow-xl">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-wider text-text-tertiary">
                Sub-Agent
              </div>
              <div
                className="truncate text-sm font-semibold text-text-primary"
                title={agent.name}
              >
                {agent.name || 'Unbenannt'}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-destructive hover:text-destructive"
              onClick={() => ctx.removeSubAgent(agent.id)}
              aria-label="Sub-Agent entfernen"
              title="Sub-Agent entfernen"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
          <AgentSettingsForm
            agent={agent as DesignerSubAgent}
            isOrchestrator={false}
            providers={ctx.providers}
            getModelsForProvider={ctx.getModelsForProvider}
            mcpServers={ctx.mcpServers}
            onChange={(patch) => ctx.updateSubAgent(agent.id, patch)}
            variant="inline"
          />
        </div>
      </NodeToolbar>
    </>
  );
};

export default SubAgentNode;
