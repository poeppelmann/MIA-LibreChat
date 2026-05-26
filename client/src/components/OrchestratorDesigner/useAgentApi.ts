import { useCallback, useMemo } from 'react';
import { useGetModelsQuery } from 'librechat-data-provider/react-query';
import { dataService, EModelEndpoint, isAssistantsEndpoint } from 'librechat-data-provider';
import type {
  Agent,
  AgentCreateParams,
  AgentProvider,
  TEndpointsConfig,
  TModelsConfig,
} from 'librechat-data-provider';
import { useGetEndpointsQuery, useMCPToolsQuery } from '~/data-provider';
import { useMCPServerManager } from '~/hooks';
import type { ModelParameters } from './types';

export interface DesignerMcpServer {
  serverName: string;
  title?: string;
  description?: string;
  iconPath?: string;
  toolIds: string[];
}
import type {
  DesignerOrchestrator,
  DesignerSubAgent,
  OrchestratorDesign,
  SaveProgressEntry,
  SaveResult,
} from './types';

const DEFAULT_PROVIDER: AgentProvider = EModelEndpoint.openAI;

/**
 * Backend accepts arbitrary `model_parameters` (validated as `z.record(z.unknown())`).
 * The shared `AgentCreateParams['model_parameters']` type is historically narrow and
 * doesn't include flexible keys like `max_tokens` — relax it locally for the designer.
 */
type DesignerCreateParams = Omit<AgentCreateParams, 'model_parameters'> & {
  model_parameters: ModelParameters;
};

const toApiParams = (params: DesignerCreateParams): AgentCreateParams =>
  params as unknown as AgentCreateParams;

export const inferProviderFromModel = (
  model: string,
  modelsConfig: TModelsConfig | undefined,
  hint?: string,
): AgentProvider => {
  if (hint && hint.trim() !== '') {
    return hint as AgentProvider;
  }
  if (!modelsConfig || !model) {
    return DEFAULT_PROVIDER;
  }
  for (const [endpoint, models] of Object.entries(modelsConfig)) {
    if (endpoint === 'initial' || endpoint === EModelEndpoint.agents) {
      continue;
    }
    if (models.includes(model)) {
      return endpoint as AgentProvider;
    }
  }
  const normalized = model.toLowerCase();
  if (normalized.startsWith('claude')) {
    return EModelEndpoint.anthropic;
  }
  if (normalized.startsWith('gpt') || normalized.startsWith('o1') || normalized.startsWith('o3')) {
    return EModelEndpoint.openAI;
  }
  if (normalized.startsWith('gemini')) {
    return EModelEndpoint.google;
  }
  return DEFAULT_PROVIDER;
};

interface HandoffTarget {
  agentId: string;
  description?: string;
  prompt?: string;
}

const expandMcpServersToTools = (
  agent: DesignerOrchestrator | DesignerSubAgent,
  mcpServers: Map<string, DesignerMcpServer>,
): string[] | undefined => {
  const selected = agent.mcpServers ?? [];
  if (selected.length === 0) {
    return agent.tools && agent.tools.length > 0 ? agent.tools : undefined;
  }
  const tools = new Set<string>();
  for (const serverName of selected) {
    const server = mcpServers.get(serverName);
    if (!server) {
      continue;
    }
    server.toolIds.forEach((id) => tools.add(id));
  }
  agent.tools?.forEach((id) => tools.add(id));
  return tools.size > 0 ? Array.from(tools) : undefined;
};

const buildCreateParams = (
  agent: DesignerOrchestrator | DesignerSubAgent,
  provider: AgentProvider,
  mcpServers: Map<string, DesignerMcpServer>,
  handoffs?: HandoffTarget[],
): DesignerCreateParams => {
  const params: DesignerCreateParams = {
    name: agent.name,
    description: agent.description || null,
    instructions: agent.systemPrompt || null,
    provider,
    model: agent.model,
    model_parameters: agent.modelParameters,
    tools: expandMcpServersToTools(agent, mcpServers),
  };

  const isOrchestrator = 'isOrchestrator' in agent && agent.isOrchestrator;
  if (isOrchestrator && handoffs && handoffs.length > 0) {
    const orchestratorRef = agent.agent_id ?? agent.id;
    params.edges = handoffs.map((target) => ({
      from: orchestratorRef,
      to: target.agentId,
      edgeType: 'handoff' as const,
      ...(target.description ? { description: target.description } : {}),
      ...(target.prompt ? { prompt: target.prompt } : {}),
    }));
  }

  return params;
};

export interface UseAgentApi {
  modelsConfig: TModelsConfig | undefined;
  endpointsConfig: TEndpointsConfig | undefined;
  providers: string[];
  getModelsForProvider: (provider: string) => string[];
  mcpServers: DesignerMcpServer[];
  saveDesign: (
    design: OrchestratorDesign,
    onProgress?: (entry: SaveProgressEntry) => void,
  ) => Promise<SaveResult>;
}

export function useAgentApi(): UseAgentApi {
  const { data: modelsConfig } = useGetModelsQuery();
  const { data: endpointsConfig } = useGetEndpointsQuery();
  const { availableMCPServers, availableMCPServersMap } = useMCPServerManager();
  const { data: mcpToolsData } = useMCPToolsQuery({
    enabled: availableMCPServers.length > 0,
  });

  const mcpServers = useMemo<DesignerMcpServer[]>(() => {
    if (availableMCPServers.length === 0) {
      return [];
    }
    return availableMCPServers.map((server) => {
      const config = availableMCPServersMap?.[server.serverName];
      const toolIds = mcpToolsData?.servers?.[server.serverName]?.tools?.map((t) => t.pluginKey) ?? [];
      return {
        serverName: server.serverName,
        title: config?.title,
        description: config?.description,
        iconPath: config?.iconPath,
        toolIds,
      };
    });
  }, [availableMCPServers, availableMCPServersMap, mcpToolsData]);

  const mcpServersIndex = useMemo(() => {
    const map = new Map<string, DesignerMcpServer>();
    mcpServers.forEach((s) => map.set(s.serverName, s));
    return map;
  }, [mcpServers]);

  const providers = useMemo(() => {
    if (!endpointsConfig) {
      return [];
    }
    return Object.keys(endpointsConfig).filter(
      (key) => !isAssistantsEndpoint(key) && key !== EModelEndpoint.agents,
    );
  }, [endpointsConfig]);

  const getModelsForProvider = useCallback(
    (provider: string): string[] => {
      if (!modelsConfig || !provider) {
        return [];
      }
      return modelsConfig[provider] ?? [];
    },
    [modelsConfig],
  );

  /* eslint-disable react-hooks/exhaustive-deps */
  // saveDesign depends on modelsConfig and the MCP index — they're captured below.
  const saveDesign = useCallback(
    async (
      design: OrchestratorDesign,
      onProgress?: (entry: SaveProgressEntry) => void,
    ): Promise<SaveResult> => {
      const entries: SaveProgressEntry[] = [];
      const handoffTargets: HandoffTarget[] = [];

      const report = (entry: SaveProgressEntry) => {
        entries.push(entry);
        onProgress?.(entry);
      };

      for (const sub of design.subAgents) {
        report({ agentId: sub.id, name: sub.name, status: 'pending' });
        try {
          const provider = inferProviderFromModel(sub.model, modelsConfig, sub.provider);
          const params = buildCreateParams(sub, provider, mcpServersIndex);
          let saved: Agent;
          const apiParams = toApiParams(params);
          if (sub.agent_id) {
            saved = await dataService.updateAgent({ agent_id: sub.agent_id, data: apiParams });
          } else {
            saved = await dataService.createAgent(apiParams);
          }
          handoffTargets.push({
            agentId: saved.id,
            description: sub.handoffDescription?.trim() || sub.description?.trim() || undefined,
            prompt: sub.handoffPrompt?.trim() || undefined,
          });
          report({
            agentId: sub.id,
            name: sub.name,
            status: 'success',
            message: `Saved as ${saved.id}`,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          report({ agentId: sub.id, name: sub.name, status: 'error', message });
          throw new Error(`Failed to save sub-agent "${sub.name}": ${message}`);
        }
      }

      report({
        agentId: design.orchestrator.id,
        name: design.orchestrator.name,
        status: 'pending',
      });

      let orchestratorAgentId: string | undefined;
      try {
        const provider = inferProviderFromModel(
          design.orchestrator.model,
          modelsConfig,
          design.orchestrator.provider,
        );
        const params = buildCreateParams(
          design.orchestrator,
          provider,
          mcpServersIndex,
          handoffTargets,
        );
        let saved: Agent;
        const apiParams = toApiParams(params);
        if (design.orchestrator.agent_id) {
          saved = await dataService.updateAgent({
            agent_id: design.orchestrator.agent_id,
            data: apiParams,
          });
        } else {
          saved = await dataService.createAgent(apiParams);
        }
        orchestratorAgentId = saved.id;
        report({
          agentId: design.orchestrator.id,
          name: design.orchestrator.name,
          status: 'success',
          message: `Saved as ${saved.id}`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        report({
          agentId: design.orchestrator.id,
          name: design.orchestrator.name,
          status: 'error',
          message,
        });
        throw new Error(`Failed to save orchestrator: ${message}`);
      }

      return {
        orchestratorAgentId,
        subAgentIds: handoffTargets.map((t) => t.agentId),
        entries,
      };
    },
    [modelsConfig, mcpServersIndex],
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  return {
    modelsConfig,
    endpointsConfig,
    providers,
    getModelsForProvider,
    mcpServers,
    saveDesign,
  };
}
