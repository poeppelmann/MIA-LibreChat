import React, { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { DesignerMcpServer } from './useAgentApi';
import type { DesignerSubAgent } from './types';

export type EditMode = 'sidepanel' | 'inline';

export interface DesignerContextValue {
  editMode: EditMode;
  providers: string[];
  getModelsForProvider: (provider: string) => string[];
  mcpServers: DesignerMcpServer[];
  updateOrchestrator: (patch: Partial<DesignerSubAgent>) => void;
  updateSubAgent: (id: string, patch: Partial<DesignerSubAgent>) => void;
  removeSubAgent: (id: string) => void;
}

const DesignerContext = createContext<DesignerContextValue | null>(null);

interface DesignerContextProviderProps extends DesignerContextValue {
  children: ReactNode;
}

export const DesignerContextProvider: React.FC<DesignerContextProviderProps> = ({
  children,
  editMode,
  providers,
  getModelsForProvider,
  mcpServers,
  updateOrchestrator,
  updateSubAgent,
  removeSubAgent,
}) => {
  const value = useMemo<DesignerContextValue>(
    () => ({
      editMode,
      providers,
      getModelsForProvider,
      mcpServers,
      updateOrchestrator,
      updateSubAgent,
      removeSubAgent,
    }),
    [
      editMode,
      providers,
      getModelsForProvider,
      mcpServers,
      updateOrchestrator,
      updateSubAgent,
      removeSubAgent,
    ],
  );

  return <DesignerContext.Provider value={value}>{children}</DesignerContext.Provider>;
};

export function useDesignerContext(): DesignerContextValue {
  const ctx = useContext(DesignerContext);
  if (!ctx) {
    throw new Error('useDesignerContext must be used within DesignerContextProvider');
  }
  return ctx;
}
