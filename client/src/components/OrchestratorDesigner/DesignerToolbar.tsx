import React, { useRef } from 'react';
import { Button } from '@librechat/client';
import {
  Download,
  Upload,
  Save,
  Trash2,
  Plus,
  FlaskConical,
  Eye,
  EyeOff,
  PanelRight,
  LayoutPanelTop,
} from 'lucide-react';
import aussendienstTestCase from './testCases/aussendienstOrchestrator.json';
import itHelpdeskTestCase from './testCases/itHelpdeskOrchestrator.json';
import { designSchema } from './orchestratorSchema';
import { MAX_SUB_AGENTS } from './useOrchestratorStore';
import LoadOrchestratorMenu from './LoadOrchestratorMenu';
import type { EditMode } from './DesignerContext';
import type { OrchestratorDesign } from './types';

interface DesignerToolbarProps {
  showJsonPanel: boolean;
  isSaving: boolean;
  subAgentCount: number;
  editMode: EditMode;
  onSetEditMode: (mode: EditMode) => void;
  onAddSubAgent: () => void;
  onReset: () => void;
  onSave: () => void;
  onExport: () => void;
  onImport: (design: OrchestratorDesign) => void;
  onLoadTestCase: (design: OrchestratorDesign) => void;
  onToggleJsonPanel: () => void;
}

const DesignerToolbar: React.FC<DesignerToolbarProps> = ({
  showJsonPanel,
  isSaving,
  subAgentCount,
  editMode,
  onSetEditMode,
  onAddSubAgent,
  onReset,
  onSave,
  onExport,
  onImport,
  onLoadTestCase,
  onToggleJsonPanel,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result);
        const parsed = JSON.parse(text);
        const result = designSchema.safeParse(parsed);
        if (!result.success) {
          throw new Error(
            result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          );
        }
        onImport(result.data as OrchestratorDesign);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid JSON';
        // eslint-disable-next-line no-alert
        alert(`Import fehlgeschlagen: ${message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border-light bg-surface-primary px-4 py-2">
      <div className="mr-2 flex items-baseline gap-2">
        <h1 className="text-sm font-semibold text-text-primary">Orchestrator Designer</h1>
        <span className="text-[11px] text-text-tertiary">
          {subAgentCount} / {MAX_SUB_AGENTS} Sub-Agents
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={onAddSubAgent}
          disabled={subAgentCount >= MAX_SUB_AGENTS}
          title={subAgentCount >= MAX_SUB_AGENTS ? `Maximal ${MAX_SUB_AGENTS} Sub-Agents` : undefined}
        >
          <Plus className="mr-1 size-3.5" /> Sub-Agent
        </Button>

        <div className="mx-1 h-5 w-px bg-border-light" />

        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onLoadTestCase(aussendienstTestCase as unknown as OrchestratorDesign)}
            title="Test-Case: Außendienst-Orchestrator"
          >
            <FlaskConical className="mr-1 size-3.5" /> Außendienst
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onLoadTestCase(itHelpdeskTestCase as unknown as OrchestratorDesign)}
          title="Test-Case: IT-HelpDesk-Orchestrator"
        >
          <FlaskConical className="mr-1 size-3.5" /> IT-HelpDesk
        </Button>

        <div className="mx-1 h-5 w-px bg-border-light" />

        <LoadOrchestratorMenu onLoad={onImport} />
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="mr-1 size-3.5" /> Export
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="mr-1 size-3.5" /> Import
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleFile}
        />

        <div className="mx-1 h-5 w-px bg-border-light" />

        <Button variant="outline" size="sm" onClick={onToggleJsonPanel}>
          {showJsonPanel ? (
            <>
              <EyeOff className="mr-1 size-3.5" /> JSON
            </>
          ) : (
            <>
              <Eye className="mr-1 size-3.5" /> JSON
            </>
          )}
        </Button>

        <div className="mx-1 h-5 w-px bg-border-light" />

        <Button
          variant="outline"
          size="sm"
          onClick={() => onSetEditMode(editMode === 'inline' ? 'sidepanel' : 'inline')}
          title={
            editMode === 'inline'
              ? 'Settings rechts in der Leiste anzeigen'
              : 'Settings inline am Node anzeigen'
          }
        >
          {editMode === 'inline' ? (
            <>
              <PanelRight className="mr-1 size-3.5" /> Leiste
            </>
          ) : (
            <>
              <LayoutPanelTop className="mr-1 size-3.5" /> Inline
            </>
          )}
        </Button>

        <Button variant="outline" size="sm" onClick={onReset}>
          <Trash2 className="mr-1 size-3.5" /> Reset
        </Button>
      </div>

      <div className="ml-auto">
        <Button variant="default" size="sm" disabled={isSaving} onClick={onSave}>
          <Save className="mr-1 size-3.5" /> {isSaving ? 'Speichert…' : 'Speichern'}
        </Button>
      </div>
    </div>
  );
};

export default DesignerToolbar;
