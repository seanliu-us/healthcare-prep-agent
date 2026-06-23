import Anthropic from "@anthropic-ai/sdk";

/**
 * Thin Anthropic client provider. Returns null when no API key is configured,
 * which makes the orchestrator transparently fall back to heuristic mode.
 */

let cached: Anthropic | null | undefined;

export const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-latest";

export function getAnthropic(): Anthropic | null {
  if (cached !== undefined) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  cached = apiKey ? new Anthropic({ apiKey }) : null;
  return cached;
}

export function llmAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
