import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { Button, ThemeContext, isDark } from '@librechat/client';
import { Check, AlertTriangle } from 'lucide-react';
import { designSchema } from './orchestratorSchema';
import type { OrchestratorDesign } from './types';

interface JsonPreviewPanelProps {
  design: OrchestratorDesign;
  onApply: (next: OrchestratorDesign) => void;
}

const JsonPreviewPanel: React.FC<JsonPreviewPanelProps> = ({ design, onApply }) => {
  const { theme } = useContext(ThemeContext);
  const monacoTheme = isDark(theme) ? 'vs-dark' : 'vs';
  const [draft, setDraft] = useState<string>(() => JSON.stringify(design, null, 2));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSerializedRef = useRef<string>('');

  const serialized = useMemo(() => JSON.stringify(design, null, 2), [design]);

  useEffect(() => {
    if (dirty) {
      return;
    }
    if (lastSerializedRef.current === serialized) {
      return;
    }
    lastSerializedRef.current = serialized;
    setDraft(serialized);
    setError(null);
  }, [serialized, dirty]);

  const handleChange = (value: string | undefined) => {
    const next = value ?? '';
    setDraft(next);
    setDirty(true);
    try {
      const parsed = JSON.parse(next);
      const result = designSchema.safeParse(parsed);
      if (!result.success) {
        setError(result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'));
        return;
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  };

  const handleApply = () => {
    try {
      const parsed = JSON.parse(draft);
      const result = designSchema.safeParse(parsed);
      if (!result.success) {
        setError(result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'));
        return;
      }
      onApply(result.data as OrchestratorDesign);
      setDirty(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  };

  const handleRevert = () => {
    setDraft(serialized);
    setDirty(false);
    setError(null);
  };

  return (
    <section className="flex h-full w-[420px] flex-col border-l border-border-light bg-surface-primary">
      <header className="flex items-center justify-between border-b border-border-light px-4 py-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Preview</div>
          <div className="text-sm font-semibold text-text-primary">JSON</div>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          {error ? (
            <span className="inline-flex items-center gap-1 text-red-500">
              <AlertTriangle className="size-3" /> invalid
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-green-600">
              <Check className="size-3" /> valid
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <MonacoEditor
          height="100%"
          defaultLanguage="json"
          value={draft}
          onChange={handleChange}
          theme={monacoTheme}
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            scrollBeyondLastLine: false,
            tabSize: 2,
            wordWrap: 'on',
          }}
        />
      </div>

      {error ? (
        <div className="max-h-32 overflow-y-auto border-t border-red-300 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:bg-red-950/30 dark:text-red-300">
          <pre className="whitespace-pre-wrap break-all">{error}</pre>
        </div>
      ) : null}

      <footer className="flex gap-2 border-t border-border-light px-4 py-3">
        <Button
          variant="default"
          size="sm"
          disabled={!dirty || !!error}
          onClick={handleApply}
          className="flex-1"
        >
          Auf Canvas anwenden
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!dirty}
          onClick={handleRevert}
        >
          Zurücksetzen
        </Button>
      </footer>
    </section>
  );
};

export default JsonPreviewPanel;
