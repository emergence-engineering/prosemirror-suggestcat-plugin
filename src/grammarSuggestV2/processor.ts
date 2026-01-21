import { EditorView } from "prosemirror-view";
import { getDiff, isIdentity } from "@emergence-engineering/fast-diff-merge";
import { ProcessingUnit, UnitProcessorResult } from "../blockRunner/types";
import { request } from "../makeRequest";
import {
  GrammarFixResult,
  GrammarSuggestion,
  GrammarUnitMetadata,
} from "./types";

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

// Create processor with API key
export const createGrammarProcessor = (apiKey: string) => {
  return async (
    _view: EditorView,
    unit: ProcessingUnit<GrammarUnitMetadata>,
  ): Promise<UnitProcessorResult<GrammarFixResult>> => {
    try {
      // Call the grammar API
      const result = await request(apiKey, unit.text);

      if (!result.fixed) {
        // No fixes needed
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
      return {
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  };
};
