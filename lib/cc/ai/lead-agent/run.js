import OpenAI from "openai";
import { getLeadAgentConfig } from "../config.js";
import { LEAD_ANALYSIS_JSON_SCHEMA, validateLeadAnalysis } from "./schema.js";
import { LEAD_AGENT_SYSTEM_PROMPT } from "./prompt.js";

/**
 * Call the configured provider and return validated analysis JSON.
 * Injectable `complete` for tests.
 *
 * @param {{ userPrompt: string, complete?: Function }} args
 */
export async function runLeadAgentCompletion({ userPrompt, complete }) {
  const config = getLeadAgentConfig();

  if (!config.configured && !complete) {
    return { ok: false, error: "not_configured" };
  }

  if (config.provider !== "openai" && !complete) {
    return { ok: false, error: "unsupported_provider" };
  }

  const runner =
    complete ||
    (async ({ system, user, model }) => {
      const client = new OpenAI({ apiKey: config.apiKey });
      const response = await client.chat.completions.create({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "mcs_lead_analysis_4a",
            strict: true,
            schema: LEAD_ANALYSIS_JSON_SCHEMA,
          },
        },
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string") {
        throw new Error("empty_completion");
      }

      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new Error("invalid_json");
      }

      return {
        parsed,
        meta: {
          id: response.id || null,
          usage: response.usage || null,
          finish_reason: response.choices?.[0]?.finish_reason || null,
        },
      };
    });

  let parsed;
  let meta = {};
  try {
    const result = await runner({
      system: LEAD_AGENT_SYSTEM_PROMPT,
      user: userPrompt,
      model: config.model,
      provider: config.provider,
    });
    parsed = result.parsed;
    meta = result.meta || {};
  } catch (error) {
    const code = error instanceof Error ? error.message : "completion_failed";
    console.error("[cc/lead-agent] completion failed");
    return {
      ok: false,
      error:
        code.startsWith("invalid_") || code === "empty_completion"
          ? code
          : "completion_failed",
    };
  }

  const validated = validateLeadAnalysis(parsed);
  if (!validated.ok) {
    return { ok: false, error: `validation_${validated.error}` };
  }

  return {
    ok: true,
    analysis: validated.analysis,
    provider: config.provider,
    model: config.model,
    promptVersion: config.promptVersion,
    meta,
  };
}
