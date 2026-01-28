import type { ApiConfig } from "./types";

// Default API endpoint for completion tasks
export const DEFAULT_COMPLETION_ENDPOINT =
  "https://suggestion-gw5lxik4dq-uc.a.run.app";

// Default API endpoint for grammar suggestions
export const DEFAULT_GRAMMAR_ENDPOINT =
  "https://prosemirror-ai-plugin.web.app/api/suggestion";

// Default model to use
export const DEFAULT_MODEL = "openai:gpt-4o-mini";
export type AIModel =
  | "openai:gpt-4o"
  | "openai:gpt-4o-mini"
  | "cerebras:llama-3.1-8b"
  | "cerebras:llama-3.3-70b"
  | "cerebras:qwen-3-32b";

// Create a complete API config with defaults
export function createApiConfig(config: ApiConfig): Required<ApiConfig> {
  return {
    apiKey: config.apiKey,
    endpoint: config.endpoint ?? DEFAULT_COMPLETION_ENDPOINT,
    model: config.model ?? DEFAULT_MODEL,
  };
}

// Create grammar API config with defaults
export function createGrammarApiConfig(config: ApiConfig): Required<ApiConfig> {
  return {
    apiKey: config.apiKey,
    endpoint: config.endpoint ?? DEFAULT_GRAMMAR_ENDPOINT,
    model: config.model ?? DEFAULT_MODEL,
  };
}
