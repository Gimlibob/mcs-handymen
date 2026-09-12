/**
 * Server-side Lead Agent provider/model configuration (Phase 4A).
 * Never expose API keys to the client bundle.
 */

export const LEAD_AGENT_PROMPT_VERSION = "lead-agent-4a-v2";

const DEFAULT_PROVIDER = "openai";
const DEFAULT_MODEL = "gpt-4o-mini";

export function getLeadAgentConfig() {
  const provider = (process.env.MCS_LEAD_AGENT_PROVIDER || DEFAULT_PROVIDER).trim().toLowerCase();
  const model = (process.env.MCS_LEAD_AGENT_MODEL || DEFAULT_MODEL).trim();
  const apiKey = process.env.OPENAI_API_KEY?.trim() || "";

  return {
    provider,
    model,
    apiKey,
    promptVersion: LEAD_AGENT_PROMPT_VERSION,
    configured: provider === "openai" && apiKey.length > 0 && model.length > 0,
  };
}
