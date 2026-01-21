import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import { Plugin, PluginKey } from "prosemirror-state";
import {
  blockRunnerPlugin,
  createBlockRunnerKey,
  RunnerState,
} from "../blockRunner";
import {
  grammarDecorationFactory,
  grammarDecorationTransformer,
  grammarWidgetFactory,
} from "./decorations";
import { createGrammarProcessor } from "./processor";
import {
  GrammarContextState,
  GrammarDecorationSpec,
  GrammarFixResult,
  GrammarSuggestV2Options,
  GrammarUnitMetadata,
} from "./types";
import {
  acceptSuggestion,
  deselectSuggestion,
  discardSuggestion,
  selectSuggestion,
} from "./actions";

type GrammarState = RunnerState<
  GrammarFixResult,
  GrammarContextState,
  GrammarUnitMetadata
>;

// Default context state
const DEFAULT_CONTEXT: GrammarContextState = {
  selectedSuggestionId: undefined,
};

// Plugin key for grammar suggest V2
export const grammarSuggestV2Key = createBlockRunnerKey<
  GrammarFixResult,
  GrammarContextState,
  GrammarUnitMetadata
>("grammarSuggestV2");

// Default popup creator - simple div with buttons
const defaultCreatePopup = (
  view: EditorView,
  decoration: Decoration,
  _pos: number,
  applySuggestion: () => void,
  discardSuggestion: () => void,
): HTMLElement => {
  const spec = decoration.spec as GrammarDecorationSpec;
  const popup = document.createElement("div");
  popup.className = "grammarPopupV2";

  const original = document.createElement("span");
  original.className = "grammarPopupV2-original";
  original.textContent = `"${spec.originalText}"`;

  const arrow = document.createElement("span");
  arrow.className = "grammarPopupV2-arrow";
  arrow.textContent = " → ";

  const replacement = document.createElement("span");
  replacement.className = "grammarPopupV2-replacement";
  replacement.textContent =
    spec.replacement === "" ? "(remove)" : `"${spec.replacement}"`;

  const acceptBtn = document.createElement("button");
  acceptBtn.className = "grammarPopupV2-accept";
  acceptBtn.textContent = "✓";
  acceptBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    applySuggestion();
  };

  const discardBtn = document.createElement("button");
  discardBtn.className = "grammarPopupV2-discard";
  discardBtn.textContent = "✕";
  discardBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    discardSuggestion();
  };

  popup.appendChild(original);
  popup.appendChild(arrow);
  popup.appendChild(replacement);
  popup.appendChild(acceptBtn);
  popup.appendChild(discardBtn);

  return popup;
};

// Create the grammar suggest V2 plugin
export function grammarSuggestPluginV2(
  apiKey: string,
  options: Partial<GrammarSuggestV2Options> = {},
): Plugin<GrammarState> {
  const {
    apiEndpoint,
    model,
    batchSize = 4,
    maxRetries = 3,
    backoffBase = 2000,
    createPopup = defaultCreatePopup,
  } = options;

  const processor = createGrammarProcessor({
    apiKey,
    apiEndpoint,
    model,
  });

  // Create the base block runner plugin
  const basePlugin = blockRunnerPlugin<
    GrammarFixResult,
    GrammarContextState,
    GrammarUnitMetadata
  >({
    pluginKey: grammarSuggestV2Key,
    unitProcessor: processor,
    decorationFactory: grammarDecorationFactory,
    decorationTransformer: grammarDecorationTransformer,
    widgetFactory: grammarWidgetFactory,
    initialContextState: DEFAULT_CONTEXT,
    options: {
      batchSize,
      maxRetries,
      backoffBase,
    },
  });

  // Extend with click handling for popup
  return new Plugin<GrammarState>({
    key: grammarSuggestV2Key,

    state: basePlugin.spec.state,

    props: {
      ...basePlugin.spec.props,

      // Override decorations to add popup widget
      decorations(editorState): DecorationSet {
        // Get base decorations from block runner - call with basePlugin as this context
        const decorationsFn = basePlugin.spec.props?.decorations;
        const baseDecorations = decorationsFn
          ? (decorationsFn.call(basePlugin, editorState) as DecorationSet)
          : DecorationSet.empty;

        const state = grammarSuggestV2Key.getState(editorState);
        if (!state?.contextState.selectedSuggestionId) {
          return baseDecorations;
        }

        // Find selected decoration
        const selectedDecoration = state.decorations.find(
          (d) => d.spec.id === state.contextState.selectedSuggestionId,
        );

        if (!selectedDecoration) {
          return baseDecorations;
        }

        // Add popup widget for selected decoration
        const popupWidget = Decoration.widget(
          selectedDecoration.from,
          (view, getPos) => {
            const pos = getPos();
            if (pos === undefined) return document.createElement("div");

            return createPopup(
              view,
              selectedDecoration,
              pos,
              () => acceptSuggestion(view, grammarSuggestV2Key, selectedDecoration.spec.id),
              () => discardSuggestion(view, grammarSuggestV2Key, selectedDecoration.spec.id),
            );
          },
          { id: selectedDecoration.spec.id, side: -1, stopEvent: () => true },
        );

        return baseDecorations.add(editorState.doc, [popupWidget]);
      },

      // Handle clicks on decorations
      handleClick(view: EditorView, pos: number, _event: MouseEvent): boolean {
        const state = grammarSuggestV2Key.getState(view.state);
        if (!state) return false;

        // Find decoration at click position
        const clickedDecoration = state.decorations.find(
          (d) => d.from <= pos && pos <= d.to,
        );

        if (!clickedDecoration) {
          // Clicked outside - deselect if something selected
          if (state.contextState.selectedSuggestionId) {
            deselectSuggestion(view, grammarSuggestV2Key);
          }
          return false;
        }

        // Check if clicking already selected decoration
        if (clickedDecoration.spec.id === state.contextState.selectedSuggestionId) {
          return false; // Already selected, let default behavior
        }

        // Select the clicked decoration
        selectSuggestion(view, grammarSuggestV2Key, clickedDecoration.spec.id);
        return false; // Don't prevent default cursor behavior
      },
    },

    view: basePlugin.spec.view,
  });
}
