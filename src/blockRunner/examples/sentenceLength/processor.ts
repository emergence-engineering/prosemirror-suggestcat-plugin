import { EditorView } from "prosemirror-view";
import { ProcessingUnit, UnitProcessorResult } from "../../types";
import {
  LongSentence,
  SentenceLengthContext,
  SentenceLengthMetadata,
  SentenceLengthResponse,
} from "./types";

// Sentence boundary regex - splits on . ! ? followed by space or end
const SENTENCE_REGEX = /[^.!?]*[.!?]+/g;

// Word regex for counting
const WORD_REGEX = /\b\w+\b/g;

// Default thresholds
const DEFAULT_WARNING_THRESHOLD = 25;
const DEFAULT_ERROR_THRESHOLD = 40;

// Count words in text
function countWords(text: string): number {
  const matches = text.match(WORD_REGEX);
  return matches ? matches.length : 0;
}

// Find long sentences in text
function findLongSentences(
  text: string,
  warningThreshold: number,
  errorThreshold: number,
): LongSentence[] {
  const longSentences: LongSentence[] = [];
  let match: RegExpExecArray | null = SENTENCE_REGEX.exec(text);

  while (match !== null) {
    const sentence = match[0];
    const wordCount = countWords(sentence);

    if (wordCount >= warningThreshold) {
      longSentences.push({
        from: match.index,
        to: match.index + sentence.length,
        wordCount,
        severity: wordCount >= errorThreshold ? "error" : "warning",
      });
    }
    match = SENTENCE_REGEX.exec(text);
  }

  return longSentences;
}

// Create processor with context access
export const createSentenceLengthProcessor = (
  getContext: () => SentenceLengthContext,
) => {
  return async (
    _view: EditorView,
    unit: ProcessingUnit<SentenceLengthMetadata>,
  ): Promise<UnitProcessorResult<SentenceLengthResponse>> => {
    const context = getContext();
    const warningThreshold =
      context.warningThreshold ?? DEFAULT_WARNING_THRESHOLD;
    const errorThreshold = context.errorThreshold ?? DEFAULT_ERROR_THRESHOLD;

    const longSentences = findLongSentences(
      unit.text,
      warningThreshold,
      errorThreshold,
    );
    return { data: longSentences };
  };
};

// Default processor using default thresholds
export const sentenceLengthProcessor = async (
  _view: EditorView,
  unit: ProcessingUnit<SentenceLengthMetadata>,
): Promise<UnitProcessorResult<SentenceLengthResponse>> => {
  const longSentences = findLongSentences(
    unit.text,
    DEFAULT_WARNING_THRESHOLD,
    DEFAULT_ERROR_THRESHOLD,
  );
  return { data: longSentences };
};
