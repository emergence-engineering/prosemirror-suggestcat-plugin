import { EditorView } from "prosemirror-view";
import { getDiff, isIdentity } from "@emergence-engineering/fast-diff-merge";
import { ProcessingUnit, UnitProcessorResult } from "../blockRunner/types";
import { grammarRequest } from "../api";
import {
  GrammarFixResult,
  GrammarSuggestion,
  GrammarUnitMetadata,
} from "./types";
import { ModelStateManager } from "./modelState";

// Parse suggestions from diff between original and fixed text
function parseSuggestions(
  originalText: string,
  fixedText: string,
): GrammarSuggestion[] {
  return getDiff(originalText, fixedText)
    .filter((diff) => !isIdentity(diff))
    .filter((diff) => diff.original !== `${diff.replacement}\n`)
    .map((diff) => ({
      from: diff.from,
      to: diff.replacement.endsWith("\n") ? diff.to - 1 : diff.to,
      original: diff.original,
      replacement: diff.replacement.endsWith("\n")
        ? diff.replacement.slice(0, -1)
        : diff.replacement,
    }));
}

export interface GrammarProcessorOptions {
  apiKey: string;
  apiEndpoint?: string;
  model?: string;
  modelStateManager?: ModelStateManager;
}

// Create processor with API options
export const createGrammarProcessor = (
  options: GrammarProcessorOptions | string,
) => {
  // Support both old (string) and new (object) API
  const { apiKey, apiEndpoint, model, modelStateManager } =
    typeof options === "string"
      ? {
          apiKey: options,
          apiEndpoint: undefined,
          model: undefined,
          modelStateManager: undefined,
        }
      : options;

  return async (
    _view: EditorView,
    unit: ProcessingUnit<GrammarUnitMetadata>,
  ): Promise<UnitProcessorResult<GrammarFixResult>> => {
    try {
      // Get current model (may be fallback if primary has failed)
      const currentModel = modelStateManager?.getCurrentModel() ?? model;

      // Call the grammar API using centralized request
      const result = await grammarRequest({
        apiKey,
        text: unit.text,
        endpoint: apiEndpoint,
        model: currentModel,
      });

      // Handle model state based on result
      if (result.error) {
        modelStateManager?.handleFailure();
      } else {
        modelStateManager?.handleSuccess();
      }

      if (!result.fixed) {
        // No fixes needed (or error occurred)
        return {
          data: {
            fixed: false,
            originalText: unit.text,
            fixedText: unit.text,
            suggestions: [],
          },
        };
      }

      // Parse the suggestions from the diff
      const suggestions = parseSuggestions(unit.text, result.result);

      return {
        data: {
          fixed: suggestions.length > 0,
          originalText: unit.text,
          fixedText: result.result,
          suggestions,
        },
      };
    } catch (error) {
      modelStateManager?.handleFailure();
      return {
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  };
};
