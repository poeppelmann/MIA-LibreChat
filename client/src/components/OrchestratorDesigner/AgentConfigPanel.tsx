import React from 'react';
import { Trash2, X } from 'lucide-react';
import { Button } from '@librechat/client';
import AgentSettingsForm from './AgentSettingsForm';
import type { DesignerMcpServer } from './useAgentApi';
import type {
  DesignerOrchestrator,
  DesignerSubAgent,
} from './types';

interface AgentConfigPanelProps {
  agent: DesignerOrchestrator | DesignerSubAgent;
  isOrchestrator: boolean;
  providers: string[];
  getModelsForProvider: (provider: string) => string[];
  mcpServers: DesignerMcpServer[];
  onChange: (patch: Partial<DesignerSubAgent>) => void;
  onClose: () => void;
  onDelete?: () => void;
}

const AgentConfigPanel: React.FC<AgentConfigPanelProps> = ({
  agent,
  isOrchestrator,
  providers,
  getModelsForProvider,
  mcpServers,
  onChange,
  onClose,
  onDelete,
}) => {
  return (
    <aside className="flex h-full w-[400px] flex-col border-l border-border-light bg-surface-primary">
      <header className="flex items-center justify-between border-b border-border-light px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary">
            {isOrchestrator ? 'Orchestrator' : 'Sub-Agent'}
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
          className="h-8 w-8 p-0"
          onClick={onClose}
          aria-label="Close panel"
        >
          <X className="size-4 text-text-primary" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <AgentSettingsForm
          agent={agent}
          isOrchestrator={isOrchestrator}
          providers={providers}
          getModelsForProvider={getModelsForProvider}
          mcpServers={mcpServers}
          onChange={onChange}
          variant="side"
        />
      </div>

      {!isOrchestrator && onDelete ? (
        <footer className="border-t border-border-light px-4 py-3">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={onDelete}
          >
            <Trash2 className="mr-2 size-4" /> Sub-Agent entfernen
          </Button>
        </footer>
      ) : null}
    </aside>
  );
};

export default AgentConfigPanel;
