import React, { useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import { Textarea, Label, Button } from '@librechat/client';
import { Sparkles, X } from 'lucide-react';
import { useDesignerContext } from './DesignerContext';

export interface HandoffEdgeData {
  subAgentId: string;
  description?: string;
  prompt?: string;
  /** Optional KI-Generator placeholder — wired in Phase 1.3. */
  onGenerateDescription?: () => void;
  [key: string]: unknown;
}

const textareaClass =
  'min-h-[56px] text-xs bg-surface-tertiary text-text-primary placeholder:text-text-tertiary';

const HandoffEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data,
}) => {
  const ctx = useDesignerContext();
  const [isOpen, setIsOpen] = useState(false);
  const edgeData = (data ?? {}) as HandoffEdgeData;
  const { subAgentId } = edgeData;
  const description = edgeData.description ?? '';
  const prompt = edgeData.prompt ?? '';

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const previewText =
    description.trim().length > 0
      ? description.trim().slice(0, 60) + (description.trim().length > 60 ? '…' : '')
      : 'Handoff beschreiben…';

  const handleDescriptionChange = (value: string) => {
    if (!subAgentId) {
      return;
    }
    ctx.updateSubAgent(subAgentId, { handoffDescription: value });
  };

  const handlePromptChange = (value: string) => {
    if (!subAgentId) {
      return;
    }
    ctx.updateSubAgent(subAgentId, { handoffPrompt: value });
  };

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
        >
          {isOpen ? (
            <div className="w-[320px] rounded-lg border border-amber-400/60 bg-surface-primary p-3 shadow-xl">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-300">
                  Handoff
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setIsOpen(false)}
                  aria-label="Schließen"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-text-secondary">
                    Beschreibung (wann delegieren?)
                  </Label>
                  <Textarea
                    value={description}
                    placeholder="z. B. ‚für Confluence-Wissensfragen‘"
                    onChange={(e) => handleDescriptionChange(e.target.value)}
                    className={textareaClass}
                  />
                  {edgeData.onGenerateDescription ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px]"
                      onClick={edgeData.onGenerateDescription}
                      title="KI generiert Beschreibung aus dem System-Prompt des Sub-Agenten"
                    >
                      <Sparkles className="mr-1 size-3" /> aus Prompt generieren
                    </Button>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-text-secondary">
                    Handoff-Prompt (optional)
                  </Label>
                  <Textarea
                    value={prompt}
                    placeholder="Anweisung, die mit dem Handoff übergeben wird"
                    onChange={(e) => handlePromptChange(e.target.value)}
                    className={textareaClass}
                  />
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className={`max-w-[200px] truncate rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm transition-colors ${
                description.trim().length > 0
                  ? 'border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/60 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/60'
                  : 'border-border-light bg-surface-primary text-text-tertiary hover:border-amber-400 hover:text-text-secondary'
              }`}
              title={description || 'Handoff bearbeiten'}
            >
              {previewText}
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export default HandoffEdge;
