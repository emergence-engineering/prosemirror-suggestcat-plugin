import { Decoration } from "prosemirror-view";
import { DecorationFactory, ProcessingUnit, ResultDecoration } from "../../types";
import { textToDocPos } from "../../utils";
import { WordComplexityMetadata, WordComplexityResponse } from "./types";

// CSS classes and styles for complexity levels
const COMPLEXITY_STYLES = {
  moderate: {
    class: "word-complexity-moderate",
    style: "background-color: rgba(255, 193, 7, 0.3); border-radius: 2px;",
  },
  high: {
    class: "word-complexity-high",
    style: "background-color: rgba(244, 67, 54, 0.3); border-radius: 2px;",
  },
};

// Decoration factory for word complexity
export const wordComplexityDecorationFactory: DecorationFactory<
  WordComplexityResponse,
  WordComplexityMetadata
> = (
  response: WordComplexityResponse,
  unit: ProcessingUnit<WordComplexityMetadata>,
): ResultDecoration<WordComplexityResponse>[] => {
  return response.map((complexWord) => {
    const docFrom = textToDocPos(complexWord.from, unit.mapping);
    const docTo = textToDocPos(complexWord.to, unit.mapping);
    const styles = COMPLEXITY_STYLES[complexWord.complexity];

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
        originalText: complexWord.word,
        response,
        syllables: complexWord.syllables,
        complexity: complexWord.complexity,
      },
    ) as ResultDecoration<WordComplexityResponse>;
  });
};
