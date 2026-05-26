import React, { useState } from 'react';
import {
  Button,
  OGDialog,
  OGDialogTrigger,
  OGDialogTemplate,
  useToastContext,
} from '@librechat/client';
import { FolderOpen, Workflow, Loader2 } from 'lucide-react';
import { useOrchestratorLibrary } from './useOrchestratorLibrary';
import type { OrchestratorDesign } from './types';

interface LoadOrchestratorMenuProps {
  onLoad: (design: OrchestratorDesign) => void;
}

const LoadOrchestratorMenu: React.FC<LoadOrchestratorMenuProps> = ({
  onLoad,
}) => {
  const { showToast } = useToastContext();
  const { orchestrators, isLoading, loadOrchestrator } = useOrchestratorLibrary();
  const [open, setOpen] = useState(false);
  const [loadingAgentId, setLoadingAgentId] = useState<string | null>(null);

  const handleSelect = async (agentId: string) => {
    setLoadingAgentId(agentId);
    try {
      const design = await loadOrchestrator(agentId);
      onLoad(design);
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Laden fehlgeschlagen';
      showToast({ message, status: 'error' });
    } finally {
      setLoadingAgentId(null);
    }
  };

  return (
    <OGDialog open={open} onOpenChange={setOpen}>
      <OGDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FolderOpen className="mr-1 size-3.5" /> Laden
        </Button>
      </OGDialogTrigger>
      <OGDialogTemplate
        title="Orchestrator laden"
        className="max-w-[560px]"
        showCloseButton
        showCancelButton={false}
        main={
          <div className="space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-text-secondary">
                <Loader2 className="size-4 animate-spin" /> Lade Liste…
              </div>
            ) : orchestrators.length === 0 ? (
              <div className="rounded-md border border-border-light bg-surface-secondary p-4 text-sm text-text-secondary">
                Keine gespeicherten Orchestratoren gefunden. Erstelle einen neuen und
                speichere ihn über die Toolbar — beim nächsten Öffnen erscheint er hier.
              </div>
            ) : (
              <ul className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
                {orchestrators.map((item) => {
                  const isItemLoading = loadingAgentId === item.agentId;
                  return (
                    <li key={item.agentId}>
                      <button
                        type="button"
                        onClick={() => handleSelect(item.agentId)}
                        disabled={isItemLoading || loadingAgentId !== null}
                        className="flex w-full items-start gap-3 rounded-lg border border-border-light bg-surface-primary p-3 text-left transition-colors hover:border-amber-400 hover:bg-surface-primary-alt disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          {isItemLoading ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Workflow className="size-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-text-primary">
                            {item.name}
                          </div>
                          {item.description ? (
                            <div className="line-clamp-2 text-xs text-text-secondary">
                              {item.description}
                            </div>
                          ) : null}
                          <div className="mt-1 text-[11px] text-text-tertiary">
                            {item.subAgentCount} Sub-Agent
                            {item.subAgentCount === 1 ? '' : 'en'}
                            <span className="ml-2 font-mono">{item.agentId.slice(0, 12)}…</span>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        }
      />
    </OGDialog>
  );
};

export default LoadOrchestratorMenu;
