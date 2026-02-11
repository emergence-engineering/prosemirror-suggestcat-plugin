import type { ApiRequestBody } from "./types";
import { DEFAULT_GRAMMAR_ENDPOINT, DEFAULT_MODEL } from "./config";

export interface GrammarRequestOptions {
  apiKey: string;
  text: string;
  endpoint?: string;
  model?: string;
}

export interface GrammarRequestResult {
  result: string;
  fixed: boolean;
  error?: boolean; // true if HTTP error or network error
}

/**
 * Make a non-streaming request to the grammar API.
 * Returns the corrected text.
 */
export async function grammarRequest(
  options: GrammarRequestOptions,
): Promise<GrammarRequestResult> {
  const {
    apiKey,
    text,
    endpoint = DEFAULT_GRAMMAR_ENDPOINT,
    model = DEFAULT_MODEL,
  } = options;

  const input = [...text.split("\n")];

  const body: ApiRequestBody = {
    model,
    modelParams: {
      input,
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error({ status: response.status, text: errorText });
      return {
        fixed: false,
        result: text,
        error: true,
      };
    }

    const jsonData: string[] = await response.json();

    if (!jsonData?.length) {
      return {
        fixed: false,
        result: text,
      };
    }

    return {
      result: jsonData.join("\n"),
      fixed: true,
    };
  } catch (error) {
    console.error("Grammar request error:", error);
    return {
      fixed: false,
      result: text,
      error: true,
    };
  }
}
