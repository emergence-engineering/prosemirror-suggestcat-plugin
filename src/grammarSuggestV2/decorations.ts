import { Decoration } from "prosemirror-view";
import {
  DecorationFactory,
  DecorationTransformer,
  ProcessingUnit,
  ResultDecoration,
  RunnerState,
  UnitStatus,
  WidgetFactory,
} from "../blockRunner/types";
import { textToDocPos } from "../blockRunner/utils";
import { GrammarContextState, GrammarDecorationSpec, GrammarFixResult, GrammarUnitMetadata, } from "./types";

// Decoration factory - creates decorations for each suggestion
export const grammarDecorationFactory: DecorationFactory<
  GrammarFixResult,
  GrammarUnitMetadata
> = (
  response: GrammarFixResult,
  unit: ProcessingUnit<GrammarUnitMetadata>,
): ResultDecoration<GrammarFixResult>[] => {
  if (!response.fixed || response.suggestions.length === 0) {
    return [];
  }

  return response.suggestions.map((suggestion) => {
    const docFrom = textToDocPos(suggestion.from, unit.mapping);
    const docTo = textToDocPos(suggestion.to, unit.mapping);

    const isRemoval = suggestion.replacement === "";
    const spec: GrammarDecorationSpec = {
      id: {},
      unitId: unit.id,
      originalText: suggestion.original,
      replacement: suggestion.replacement,
      response,
    };

    return Decoration.inline(
      docFrom,
      docTo,
      {
        class: `grammarSuggestionV2 ${isRemoval ? "removalSuggestionV2" : ""}`,
      },
      spec,
    ) as ResultDecoration<GrammarFixResult>;
  });
};

// Decoration transformer - highlights selected suggestion
export const grammarDecorationTransformer: DecorationTransformer<
  GrammarFixResult,
  GrammarContextState,
  GrammarUnitMetadata
> = (
  decorations: ResultDecoration<GrammarFixResult>[],
  state: RunnerState<GrammarFixResult, GrammarContextState, GrammarUnitMetadata>,
): ResultDecoration<GrammarFixResult>[] => {
  const selectedId = state.contextState.selectedSuggestionId;
  if (!selectedId) return decorations;

  return decorations.map((decoration) => {
    const spec = decoration.spec as unknown as GrammarDecorationSpec;
    if (spec.id === selectedId) {
      // Recreate with selected class
      return Decoration.inline(
        decoration.from,
        decoration.to,
        {
          class: "grammarSuggestionV2 grammarSuggestionV2-selected",
        },
        spec,
      ) as ResultDecoration<GrammarFixResult>;
    }
    return decoration;
  });
};

// Widget factory - shows loading/error states
export const grammarWidgetFactory: WidgetFactory<GrammarUnitMetadata> = (
  unit: ProcessingUnit<GrammarUnitMetadata>,
): Decoration | undefined => {
  let content: string;
  let className: string;

  switch (unit.status) {
    case UnitStatus.QUEUED:
    case UnitStatus.WAITING:
      content = "⏳";
      className = "grammarWidgetV2 queued";
      break;
    case UnitStatus.PROCESSING:
      content = "🔍";
      className = "grammarWidgetV2 processing";
      break;
    case UnitStatus.BACKOFF:
      const waitTime = Math.max(0, unit.waitUntil - Date.now());
      content = `🔄 ${Math.ceil(waitTime / 1000)}s`;
      className = "grammarWidgetV2 backoff";
      break;
    case UnitStatus.ERROR:
      content = "❌";
      className = "grammarWidgetV2 error";
      break;
    case UnitStatus.DIRTY:
      content = "✏️";
      className = "grammarWidgetV2 dirty";
      break;
    default:
      return undefined;
  }

  const widget = document.createElement("span");
  widget.className = className;
  widget.textContent = content;

  // Place at unit.from + 1 to be inside the paragraph (not before it)
  // This ensures the widget is a child of the <p>, allowing absolute positioning relative to it
  return Decoration.widget(unit.from + 1, widget, { side: -1 });
};
