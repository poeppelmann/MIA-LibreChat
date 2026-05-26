import React, { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  type EdgeTypes,
  type NodeMouseHandler,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useToastContext } from '@librechat/client';
import { useOrchestratorStore } from './useOrchestratorStore';
import { useAgentApi } from './useAgentApi';
import { designSchema } from './orchestratorSchema';
import OrchestratorNode from './OrchestratorNode';
import SubAgentNode from './SubAgentNode';
import HandoffEdge, { type HandoffEdgeData } from './HandoffEdge';
import { suggestHandoffDescription } from './handoffSuggestion';
import AgentConfigPanel from './AgentConfigPanel';
import JsonPreviewPanel from './JsonPreviewPanel';
import DesignerToolbar from './DesignerToolbar';
import { DesignerContextProvider, type EditMode } from './DesignerContext';
import type { DesignerNode, DesignerEdge, DesignerSubAgent, OrchestratorDesign } from './types';

const ORCHESTRATOR_Y = 40;
const SUB_AGENT_Y_SIDE = 280;
const SUB_AGENT_Y_INLINE = 420;
const SUB_AGENT_SPACING = 280;

const nodeTypes: NodeTypes = {
  orchestrator: OrchestratorNode,
  subAgent: SubAgentNode,
};

const edgeTypes: EdgeTypes = {
  handoff: HandoffEdge,
};

const OrchestratorDesigner: React.FC = () => {
  const store = useOrchestratorStore();
  const api = useAgentApi();
  const { showToast } = useToastContext();
  const [showJsonPanel, setShowJsonPanel] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editMode, setEditMode] = useState<EditMode>('inline');

  const {
    orchestrator,
    subAgents,
    selection,
    select,
    updateOrchestrator,
    updateSubAgent,
    addSubAgent,
    removeSubAgent,
    loadDesign,
    resetDesign,
    toDesign,
  } = store;

  const updateOrchestratorAdapter = useCallback(
    (patch: Partial<DesignerSubAgent>) => {
      const { handoffDescription: _hd, handoffPrompt: _hp, isOrchestrator: _io, ...rest } = patch;
      updateOrchestrator(rest);
    },
    [updateOrchestrator],
  );

  const subAgentTotalWidth = Math.max(0, subAgents.length - 1) * SUB_AGENT_SPACING;
  const orchestratorX = subAgentTotalWidth / 2;
  const subAgentY = editMode === 'inline' ? SUB_AGENT_Y_INLINE : SUB_AGENT_Y_SIDE;

  const nodes = useMemo<DesignerNode[]>(() => {
    const orchestratorNode: DesignerNode = {
      id: orchestrator.id,
      type: 'orchestrator',
      position: { x: orchestratorX, y: ORCHESTRATOR_Y },
      data: {
        agent: orchestrator,
        selected: selection?.kind === 'orchestrator',
      },
      draggable: true,
    };

    const subNodes: DesignerNode[] = subAgents.map((agent, index) => ({
      id: agent.id,
      type: 'subAgent',
      position: { x: index * SUB_AGENT_SPACING, y: subAgentY },
      data: {
        agent,
        selected: selection?.kind === 'subAgent' && selection.id === agent.id,
      },
      draggable: true,
    }));

    return [orchestratorNode, ...subNodes];
  }, [orchestrator, subAgents, selection, orchestratorX, subAgentY]);

  const edges = useMemo<DesignerEdge[]>(
    () =>
      subAgents.map((agent) => {
        const edgeData: HandoffEdgeData = {
          subAgentId: agent.id,
          description: agent.handoffDescription,
          prompt: agent.handoffPrompt,
          onGenerateDescription: () =>
            updateSubAgent(agent.id, {
              handoffDescription: suggestHandoffDescription(agent),
            }),
        };
        return {
          id: `${orchestrator.id}->${agent.id}`,
          source: orchestrator.id,
          target: agent.id,
          type: 'handoff',
          data: edgeData,
          animated: false,
          style: { stroke: '#f59e0b', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b' },
        };
      }),
    [orchestrator.id, subAgents, updateSubAgent],
  );

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.id === orchestrator.id) {
        select({ kind: 'orchestrator' });
      } else {
        select({ kind: 'subAgent', id: node.id });
      }
    },
    [orchestrator.id, select],
  );

  const handlePaneClick = useCallback(() => {
    select(null);
  }, [select]);

  const handleExport = useCallback(() => {
    const design = toDesign();
    const blob = new Blob([JSON.stringify(design, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeName = (design.orchestrator.name || 'orchestrator')
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-');
    link.download = `${safeName}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [toDesign]);

  const handleImport = useCallback(
    (design: OrchestratorDesign) => {
      loadDesign(design);
      showToast({ message: `Imported "${design.orchestrator.name}"`, status: 'success' });
    },
    [loadDesign, showToast],
  );

  const handleLoadTestCase = useCallback(
    (rawDesign: OrchestratorDesign) => {
      const result = designSchema.safeParse(rawDesign);
      if (!result.success) {
        showToast({
          message: `Test-Case ungültig: ${result.error.issues[0]?.message ?? 'Schema-Fehler'}`,
          status: 'error',
        });
        return;
      }
      loadDesign(result.data as OrchestratorDesign);
      showToast({
        message: `Test-Case "${result.data.orchestrator.name}" geladen`,
        status: 'success',
      });
    },
    [loadDesign, showToast],
  );

  const handleSave = useCallback(async () => {
    const design = toDesign();
    const result = designSchema.safeParse(design);
    if (!result.success) {
      showToast({
        message: `Validation fehlgeschlagen: ${result.error.issues[0]?.message ?? 'Schema-Fehler'}`,
        status: 'error',
      });
      return;
    }
    if (!design.orchestrator.model) {
      showToast({ message: 'Orchestrator-Modell wählen', status: 'error' });
      return;
    }
    const missingModelOnSub = design.subAgents.find((agent) => !agent.model);
    if (missingModelOnSub) {
      showToast({
        message: `Modell fehlt für "${missingModelOnSub.name}"`,
        status: 'error',
      });
      return;
    }

    setIsSaving(true);
    try {
      const saveResult = await api.saveDesign(design);
      const created = saveResult.entries.filter((e) => e.status === 'success').length;
      showToast({
        message: `${created} Agent${created === 1 ? '' : 'en'} gespeichert (Orchestrator: ${
          saveResult.orchestratorAgentId ?? 'n/a'
        })`,
        status: 'success',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Speichern fehlgeschlagen';
      showToast({ message, status: 'error' });
    } finally {
      setIsSaving(false);
    }
  }, [toDesign, api, showToast]);

  const handlePanelClose = useCallback(() => select(null), [select]);

  const selectedAgent = useMemo(() => {
    if (!selection) {
      return null;
    }
    if (selection.kind === 'orchestrator') {
      return orchestrator;
    }
    return subAgents.find((agent) => agent.id === selection.id) ?? null;
  }, [selection, orchestrator, subAgents]);

  const showSidePanel = editMode === 'sidepanel' && selectedAgent !== null;

  return (
    <DesignerContextProvider
      editMode={editMode}
      providers={api.providers}
      getModelsForProvider={api.getModelsForProvider}
      mcpServers={api.mcpServers}
      updateOrchestrator={updateOrchestratorAdapter}
      updateSubAgent={updateSubAgent}
      removeSubAgent={removeSubAgent}
    >
      <div className="flex h-full w-full flex-col bg-surface-secondary">
        <DesignerToolbar
          showJsonPanel={showJsonPanel}
          isSaving={isSaving}
          subAgentCount={subAgents.length}
          editMode={editMode}
          onSetEditMode={setEditMode}
          onAddSubAgent={addSubAgent}
          onReset={resetDesign}
          onSave={handleSave}
          onExport={handleExport}
          onImport={handleImport}
          onLoadTestCase={handleLoadTestCase}
          onToggleJsonPanel={() => setShowJsonPanel((prev) => !prev)}
        />

        <div className="flex min-h-0 flex-1">
          <div className="flex-1">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodeClick={handleNodeClick}
              onPaneClick={handlePaneClick}
              fitView
              fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={16} size={1} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>

          {showSidePanel && selectedAgent ? (
            <AgentConfigPanel
              agent={selectedAgent}
              isOrchestrator={selection?.kind === 'orchestrator'}
              providers={api.providers}
              getModelsForProvider={api.getModelsForProvider}
              mcpServers={api.mcpServers}
              onChange={(patch) => {
                if (selection?.kind === 'orchestrator') {
                  updateOrchestratorAdapter(patch);
                } else if (selection?.kind === 'subAgent') {
                  updateSubAgent(selection.id, patch);
                }
              }}
              onClose={handlePanelClose}
              onDelete={
                selection?.kind === 'subAgent'
                  ? () => removeSubAgent(selection.id)
                  : undefined
              }
            />
          ) : null}

          {showJsonPanel ? (
            <JsonPreviewPanel design={toDesign()} onApply={loadDesign} />
          ) : null}
        </div>
      </div>
    </DesignerContextProvider>
  );
};

export default OrchestratorDesigner;
