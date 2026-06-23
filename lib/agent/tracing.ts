import type { AgentMode, TracePayload } from "@/lib/types";

/**
 * Lightweight in-run tracer for the observability bonus. Collects per-tool
 * counts, durations, and token usage and renders a TracePayload for the UI.
 */
export class Tracer {
  private start = Date.now();
  private toolCalls = 0;
  private toolBreakdown: Record<string, number> = {};
  private toolDurations: number[] = [];
  private llmCalls = 0;
  private inputTokens = 0;
  private outputTokens = 0;

  constructor(private mode: AgentMode) {}

  recordTool(tool: string, durationMs: number) {
    this.toolCalls += 1;
    this.toolBreakdown[tool] = (this.toolBreakdown[tool] ?? 0) + 1;
    this.toolDurations.push(durationMs);
  }

  recordLlmCall(inputTokens?: number, outputTokens?: number) {
    this.llmCalls += 1;
    if (inputTokens) this.inputTokens += inputTokens;
    if (outputTokens) this.outputTokens += outputTokens;
  }

  snapshot(): TracePayload {
    return {
      totalToolCalls: this.toolCalls,
      toolBreakdown: { ...this.toolBreakdown },
      llmCalls: this.llmCalls,
      inputTokens: this.inputTokens || undefined,
      outputTokens: this.outputTokens || undefined,
      elapsedMs: Date.now() - this.start,
      mode: this.mode,
    };
  }
}
