import { z } from 'zod';
import { SCHEMA_VERSION } from './types';

const modelParametersSchema = z
  .object({
    temperature: z.number().min(0).max(2).optional(),
    max_tokens: z.number().int().positive().optional(),
    top_p: z.number().min(0).max(1).optional(),
    frequency_penalty: z.number().min(-2).max(2).optional(),
    presence_penalty: z.number().min(-2).max(2).optional(),
  })
  .passthrough();

const externalConnectionsSchema = z
  .object({
    ragServerUrl: z.string().url().or(z.literal('')).optional(),
    knowledgeBaseIds: z.array(z.string()).optional(),
    knowledgeBaseSpaces: z.array(z.string()).optional(),
    mcpEndpoints: z.array(z.string()).optional(),
    customApiEndpoints: z.array(z.string()).optional(),
  })
  .partial();

const agentBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Name is required'),
  model: z.string().min(1, 'Model is required'),
  provider: z.string().optional(),
  systemPrompt: z.string().default(''),
  description: z.string().default(''),
  modelParameters: modelParametersSchema.default({}),
  mcpServers: z.array(z.string()).optional(),
  externalConnections: externalConnectionsSchema.optional(),
  tools: z.array(z.string()).optional(),
  capabilities: z.array(z.string()).optional(),
  agent_id: z.string().optional(),
});

export const orchestratorSchema = agentBaseSchema.extend({
  isOrchestrator: z.literal(true),
});

export const subAgentSchema = agentBaseSchema.extend({
  isOrchestrator: z.literal(false).optional(),
  handoffDescription: z.string().optional(),
  handoffPrompt: z.string().optional(),
});

export const designSchema = z.object({
  schemaVersion: z.string().default(SCHEMA_VERSION),
  exportedAt: z.string().default(() => new Date().toISOString()),
  orchestrator: orchestratorSchema,
  subAgents: z.array(subAgentSchema).default([]),
});

export type DesignSchemaInput = z.input<typeof designSchema>;
export type DesignSchemaOutput = z.output<typeof designSchema>;

export const agentFormSchema = agentBaseSchema;
export type AgentFormValues = z.output<typeof agentFormSchema>;
