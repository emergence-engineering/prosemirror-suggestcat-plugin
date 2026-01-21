import type { TaskType, TaskParams } from "../types";

// API configuration interface
export interface ApiConfig {
  apiKey: string;
  endpoint?: string;
  model?: string;
}

// Request body for AI tasks
export interface ApiRequestBody {
  model: string;
  modelParams: {
    input: string[];
    task?: TaskType;
    params?: TaskParams;
  };
}

// Streaming callbacks
export interface StreamingCallbacks {
  onChunk: (chunk: string, accumulated: string) => void;
  onComplete: (result: string) => void;
  onError: (error: Error) => void;
}

// Non-streaming response (grammar)
export interface GrammarApiResponse {
  result: string;
  fixed: boolean;
  mod?: {
    original: string;
    fixed: string;
    position: number;
    type: string;
  }[];
}
