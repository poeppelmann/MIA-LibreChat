import type { DesignerSubAgent } from './types';

/**
 * Local heuristic placeholder used until the AI helper backend endpoint
 * lands in Phase 2. Extracts the most informative leading clause from the
 * sub-agent's system prompt or description.
 */
export function suggestHandoffDescription(agent: DesignerSubAgent): string {
  const candidates: string[] = [];
  if (agent.systemPrompt?.trim()) {
    candidates.push(agent.systemPrompt.trim());
  }
  if (agent.description?.trim()) {
    candidates.push(agent.description.trim());
  }
  for (const text of candidates) {
    const sentence = firstSubstantialSentence(text);
    if (sentence) {
      return reframeAsHandoff(sentence, agent.name);
    }
  }
  return `Delegiere an ${agent.name || 'diesen Sub-Agenten'}, wenn die Anfrage in seinen Fachbereich fällt.`;
}

function firstSubstantialSentence(text: string): string | null {
  const stripped = text.replace(/^\s*(Du bist|You are)\s*/i, '');
  const parts = stripped.split(/(?<=[.!?])\s+/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.length >= 20) {
      return trimmed.replace(/[.!?]+$/, '');
    }
  }
  const fallback = stripped.trim();
  return fallback.length > 0 ? fallback.slice(0, 200) : null;
}

function reframeAsHandoff(sentence: string, agentName: string): string {
  const lower = sentence.charAt(0).toLowerCase() + sentence.slice(1);
  const name = agentName?.trim() || 'dieser Sub-Agent';
  return `Delegiere an ${name}, wenn ${lower}.`.slice(0, 240);
}
