import { useCallback, useMemo } from 'react';
import {
  PermissionBits,
  Constants,
  dataService,
} from 'librechat-data-provider';
import type {
  Agent,
  AgentListResponse,
  GraphEdge,
} from 'librechat-data-provider';
import { useListAgentsQuery } from '~/data-provider';
import { SCHEMA_VERSION } from './types';
import type {
  DesignerOrchestrator,
  DesignerSubAgent,
  ModelParameters,
  OrchestratorDesign,
} from './types';

export interface OrchestratorListItem {
  agentId: string;
  name: string;
  description: string;
  subAgentCount: number;
  updatedAt: number;
}

const MCP_DELIMITER = Constants.mcp_delimiter;

function isStringTarget(target: GraphEdge['to']): target is string {
  return typeof target === 'string';
}

function extractMcpServerNames(tools: string[] | undefined): string[] {
  if (!tools || tools.length === 0) {
    return [];
  }
  const servers = new Set<string>();
  for (const toolId of tools) {
    const idx = toolId.indexOf(MCP_DELIMITER);
    if (idx >= 0) {
      const server = toolId.slice(idx + MCP_DELIMITER.length);
      if (server) {
        servers.add(server);
      }
    }
  }
  return Array.from(servers);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function toDesignerOrchestrator(agent: Agent): DesignerOrchestrator {
  return {
    id: agent.id,
    agent_id: agent.id,
    isOrchestrator: true,
    name: agent.name ?? 'Unbenannt',
    description: agent.description ?? '',
    systemPrompt: agent.instructions ?? '',
    provider: agent.provider,
    model: agent.model ?? '',
    modelParameters: (agent.model_parameters ?? {}) as unknown as ModelParameters,
    mcpServers: extractMcpServerNames(agent.tools),
    tools: agent.tools,
  };
}

function toDesignerSubAgent(
  agent: Agent,
  edge: GraphEdge | undefined,
): DesignerSubAgent {
  const handoffDescription = edge?.description;
  const handoffPrompt = typeof edge?.prompt === 'string' ? edge.prompt : undefined;
  return {
    id: agent.id,
    agent_id: agent.id,
    name: agent.name ?? 'Unbenannt',
    description: agent.description ?? '',
    systemPrompt: agent.instructions ?? '',
    provider: agent.provider,
    model: agent.model ?? '',
    modelParameters: (agent.model_parameters ?? {}) as unknown as ModelParameters,
    mcpServers: extractMcpServerNames(agent.tools),
    tools: agent.tools,
    handoffDescription,
    handoffPrompt,
  };
}

export interface UseOrchestratorLibrary {
  orchestrators: OrchestratorListItem[];
  isLoading: boolean;
  loadOrchestrator: (agentId: string) => Promise<OrchestratorDesign>;
}

export function useOrchestratorLibrary(): UseOrchestratorLibrary {
  const { data, isLoading } = useListAgentsQuery({
    limit: 100,
    requiredPermission: PermissionBits.VIEW,
  });

  const agentsById = useMemo(() => {
    const map = new Map<string, Agent>();
    const list = (data as AgentListResponse | undefined)?.data ?? [];
    for (const agent of list) {
      map.set(agent.id, agent);
    }
    return map;
  }, [data]);

  const orchestrators = useMemo<OrchestratorListItem[]>(() => {
    const list = (data as AgentListResponse | undefined)?.data ?? [];
    return list
      .filter((agent) => (agent.edges?.length ?? 0) > 0)
      .map((agent) => ({
        agentId: agent.id,
        name: agent.name ?? 'Unbenannt',
        description: agent.description ?? '',
        subAgentCount: agent.edges?.length ?? 0,
        updatedAt: agent.created_at ?? 0,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [data]);

  const loadOrchestrator = useCallback(
    async (agentId: string): Promise<OrchestratorDesign> => {
      const orchestratorAgent =
        agentsById.get(agentId) ?? (await dataService.getAgentById({ agent_id: agentId }));
      const edges = orchestratorAgent.edges ?? [];
      const subAgentIds: string[] = [];
      const seen = new Set<string>();
      for (const edge of edges) {
        const targets = isStringTarget(edge.to) ? [edge.to] : edge.to;
        for (const id of targets) {
          if (!seen.has(id)) {
            seen.add(id);
            subAgentIds.push(id);
          }
        }
      }

      const subAgents = await Promise.all(
        subAgentIds.map(async (id) => {
          const cached = agentsById.get(id);
          if (cached) {
            return cached;
          }
          return dataService.getAgentById({ agent_id: id });
        }),
      );

      const edgesBySubAgentId = new Map<string, GraphEdge>();
      for (const edge of edges) {
        const targets = isStringTarget(edge.to) ? [edge.to] : edge.to;
        for (const id of targets) {
          if (!edgesBySubAgentId.has(id)) {
            edgesBySubAgentId.set(id, edge);
          }
        }
      }

      return {
        schemaVersion: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        orchestrator: toDesignerOrchestrator(orchestratorAgent),
        subAgents: subAgents.map((sub) =>
          toDesignerSubAgent(sub, edgesBySubAgentId.get(sub.id)),
        ),
      };
    },
    [agentsById],
  );

  // Suppress unused-import lint for asString helper kept for future fields.
  void asString;

  return { orchestrators, isLoading, loadOrchestrator };
}
