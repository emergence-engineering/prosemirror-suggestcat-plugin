import { Decoration } from "prosemirror-view";
import { DecorationFactory, ProcessingUnit, ResultDecoration } from "../../types";
import { textToDocPos } from "../../utils";
import { SentenceLengthMetadata, SentenceLengthResponse } from "./types";

// CSS classes and styles for severity levels
const SEVERITY_STYLES = {
  warning: {
    class: "sentence-too-long-warning",
    style: "background-color: rgba(255, 152, 0, 0.2); border-radius: 2px;",
  },
  error: {
    class: "sentence-too-long-error",
    style: "background-color: rgba(244, 67, 54, 0.2); border-radius: 2px;",
  },
};

// Decoration factory for sentence length
export const sentenceLengthDecorationFactory: DecorationFactory<
  SentenceLengthResponse,
  SentenceLengthMetadata
> = (
  response: SentenceLengthResponse,
  unit: ProcessingUnit<SentenceLengthMetadata>,
): ResultDecoration<SentenceLengthResponse>[] => {
  return response.map((longSentence) => {
    const docFrom = textToDocPos(longSentence.from, unit.mapping);
    const docTo = textToDocPos(longSentence.to, unit.mapping);
    const styles = SEVERITY_STYLES[longSentence.severity];

    return Decoration.inline(
      docFrom,
      docTo,
      {
        class: styles.class,
        style: styles.style,
      },
      {
        id: {},
        unitId: unit.id,
        originalText: unit.text.slice(longSentence.from, longSentence.to),
        response,
        wordCount: longSentence.wordCount,
        severity: longSentence.severity,
      },
    ) as ResultDecoration<SentenceLengthResponse>;
  });
};
