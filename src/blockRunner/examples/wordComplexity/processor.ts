import { EditorView } from "prosemirror-view";
import { ProcessingUnit, UnitProcessorResult } from "../../types";
import {
  ComplexWord,
  WordComplexityContext,
  WordComplexityMetadata,
  WordComplexityResponse,
} from "./types";

// Count syllables in a word using vowel-based heuristic
export function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length <= 3) return 1;

  // Remove silent e's and ed endings
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");

  // Count vowel groups
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? Math.max(1, matches.length) : 1;
}

// Word regex - matches words (letters only)
const WORD_REGEX = /[a-zA-Z]+/g;

// Default thresholds
const DEFAULT_MODERATE_THRESHOLD = 3;
const DEFAULT_HIGH_THRESHOLD = 4;

// Find complex words in text
function findComplexWords(
  text: string,
  moderateThreshold: number,
  highThreshold: number,
): ComplexWord[] {
  const complexWords: ComplexWord[] = [];
  let match: RegExpExecArray | null;

  while ((match = WORD_REGEX.exec(text)) !== null) {
    const word = match[0];
    const syllables = countSyllables(word);

    if (syllables >= moderateThreshold) {
      complexWords.push({
        word,
        from: match.index,
        to: match.index + word.length,
        syllables,
        complexity: syllables >= highThreshold ? "high" : "moderate",
      });
    }
  }

  return complexWords;
}

// Create processor with context access
export const createWordComplexityProcessor = (
  getContext: () => WordComplexityContext,
) => {
  return async (
    _view: EditorView,
    unit: ProcessingUnit<WordComplexityMetadata>,
  ): Promise<UnitProcessorResult<WordComplexityResponse>> => {
    const context = getContext();
    const moderateThreshold =
      context.moderateThreshold ?? DEFAULT_MODERATE_THRESHOLD;
    const highThreshold = context.highThreshold ?? DEFAULT_HIGH_THRESHOLD;

    const complexWords = findComplexWords(
      unit.text,
      moderateThreshold,
      highThreshold,
    );
    return { data: complexWords };
  };
};

// Default processor using default thresholds
export const wordComplexityProcessor = async (
  _view: EditorView,
  unit: ProcessingUnit<WordComplexityMetadata>,
): Promise<UnitProcessorResult<WordComplexityResponse>> => {
  const complexWords = findComplexWords(
    unit.text,
    DEFAULT_MODERATE_THRESHOLD,
    DEFAULT_HIGH_THRESHOLD,
  );
  return { data: complexWords };
};
