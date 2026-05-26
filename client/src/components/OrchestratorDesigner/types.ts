import type { Node, Edge } from '@xyflow/react';

export const SCHEMA_VERSION = '1.0';

export type ModelParameterValue = number | string | undefined;
export type ModelParameters = Record<string, ModelParameterValue>;

export interface ExternalConnections {
  ragServerUrl?: string;
  knowledgeBaseIds?: string[];
  knowledgeBaseSpaces?: string[];
  mcpEndpoints?: string[];
  customApiEndpoints?: string[];
}

export interface DesignerAgentBase {
  id: string;
  name: string;
  model: string;
  provider?: string;
  systemPrompt: string;
  description: string;
  modelParameters: ModelParameters;
  /** Names of configured MCP servers granted to this agent (LibreChat librechat.yaml). */
  mcpServers?: string[];
  /** @deprecated kept for JSON round-trip with legacy test cases. UI uses mcpServers. */
  externalConnections?: ExternalConnections;
  /** @deprecated kept for JSON round-trip. Tools are derived from mcpServers at save time. */
  tools?: string[];
  capabilities?: string[];
  agent_id?: string;
}

export interface DesignerOrchestrator extends DesignerAgentBase {
  isOrchestrator: true;
}

export interface DesignerSubAgent extends DesignerAgentBase {
  isOrchestrator?: false;
  /** Description shown to the orchestrator on the handoff tool. */
  handoffDescription?: string;
  /** Optional prompt template passed when the orchestrator delegates. */
  handoffPrompt?: string;
}

export interface OrchestratorDesign {
  schemaVersion: string;
  exportedAt: string;
  orchestrator: DesignerOrchestrator;
  subAgents: DesignerSubAgent[];
}

export type DesignerNodeData = {
  agent: DesignerOrchestrator | DesignerSubAgent;
  selected: boolean;
};

export type DesignerNode = Node<DesignerNodeData, 'orchestrator' | 'subAgent'>;
export type DesignerEdge = Edge;

export type AgentSelection =
  | { kind: 'orchestrator' }
  | { kind: 'subAgent'; id: string }
  | null;

export interface SaveProgressEntry {
  agentId: string;
  name: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
}

export interface SaveResult {
  orchestratorAgentId?: string;
  subAgentIds: string[];
  entries: SaveProgressEntry[];
}
