import type { SearchResult } from "@/lib/types";
import { knowledgeBaseSearch } from "@/lib/data/payers";

/**
 * Source 2 — Search tool.
 *
 * Uses Tavily (https://tavily.com) when TAVILY_API_KEY is configured for real
 * web research. Otherwise falls back to a curated payer knowledge base so the
 * agent's research loop is fully functional offline / without keys.
 */

export interface SearchResponse {
  query: string;
  provider: "tavily" | "knowledge_base";
  results: SearchResult[];
  answer?: string;
}

export function searchProvider(): "tavily" | "knowledge_base" {
  return process.env.TAVILY_API_KEY ? "tavily" : "knowledge_base";
}

export async function webSearch(
  query: string,
  context: { carrier: string },
): Promise<SearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (apiKey) {
    try {
      return await tavilySearch(query, apiKey);
    } catch (err) {
      // Degrade gracefully to the knowledge base rather than failing the run.
      console.error("[search] Tavily failed, falling back to knowledge base:", err);
    }
  }

  return {
    query,
    provider: "knowledge_base",
    results: knowledgeBaseSearch(query, context.carrier),
  };
}

async function tavilySearch(query: string, apiKey: string): Promise<SearchResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "advanced",
        include_answer: true,
        max_results: 5,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Tavily HTTP ${res.status}`);
    }

    const json = (await res.json()) as {
      answer?: string;
      results?: Array<{ title: string; url: string; content: string; published_date?: string }>;
    };

    return {
      query,
      provider: "tavily",
      answer: json.answer,
      results: (json.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.content,
        publishedHint: r.published_date,
      })),
    };
  } finally {
    clearTimeout(timeout);
  }
}
