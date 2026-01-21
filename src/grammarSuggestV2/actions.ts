import { PluginKey, TextSelection } from "prosemirror-state";
import { Decoration, EditorView } from "prosemirror-view";
import { Fragment, Slice } from "prosemirror-model";
import { ActionType, dispatchAction, RunnerState } from "../blockRunner";
import {
  GrammarContextState,
  GrammarDecorationSpec,
  GrammarFixResult,
  GrammarUnitMetadata,
} from "./types";

type GrammarState = RunnerState<
  GrammarFixResult,
  GrammarContextState,
  GrammarUnitMetadata
>;

// Find a decoration by ID in the plugin state
function findDecorationById(
  view: EditorView,
  pluginKey: PluginKey<GrammarState>,
  decorationId: object,
): Decoration | undefined {
  const state = pluginKey.getState(view.state);
  if (!state) return undefined;

  return state.decorations.find((d) => d.spec.id === decorationId);
}

// Accept a suggestion - applies the fix and removes the decoration
export function acceptSuggestion(
  view: EditorView,
  pluginKey: PluginKey<GrammarState>,
  decorationId: object,
): void {
  const decoration = findDecorationById(view, pluginKey, decorationId);
  if (!decoration) return;

  const spec = decoration.spec as GrammarDecorationSpec;
  const { replacement } = spec;
  const { from, to } = decoration;

  // Handle multi-paragraph replacements
  const paragraphs = replacement.split("\n");

  const paragraphNodes = paragraphs.map((paragraph) => {
    if (!paragraph) {
      return view.state.schema.node("paragraph");
    }
    return view.state.schema.node(
      "paragraph",
      null,
      view.state.schema.text(paragraph),
    );
  });

  const fragment = Fragment.fromArray(paragraphNodes);

  // Apply the text replacement
  let { tr } = view.state;
  tr = tr.setSelection(TextSelection.create(view.state.doc, from, to));
  tr.selection.replace(tr, new Slice(fragment, 1, 1));

  // Remove the decoration via action
  tr = tr.setMeta(pluginKey, {
    type: ActionType.REMOVE_DECORATION,
    id: decorationId,
  });

  view.dispatch(tr);
}

// Discard a suggestion - removes the decoration without applying the fix
export function discardSuggestion(
  view: EditorView,
  pluginKey: PluginKey<GrammarState>,
  decorationId: object,
): void {
  dispatchAction(view, pluginKey, {
    type: ActionType.REMOVE_DECORATION,
    id: decorationId,
  });
}

// Select a suggestion - for popup display
export function selectSuggestion(
  view: EditorView,
  pluginKey: PluginKey<GrammarState>,
  decorationId: object,
): void {
  // Update context state with selected ID
  dispatchAction(view, pluginKey, {
    type: ActionType.UPDATE_CONTEXT,
    contextState: { selectedSuggestionId: decorationId },
  });
}

// Deselect the current suggestion
export function deselectSuggestion(
  view: EditorView,
  pluginKey: PluginKey<GrammarState>,
): void {
  dispatchAction(view, pluginKey, {
    type: ActionType.UPDATE_CONTEXT,
    contextState: { selectedSuggestionId: undefined },
  });
}

// Get the currently selected decoration
export function getSelectedDecoration(
  view: EditorView,
  pluginKey: PluginKey<GrammarState>,
): Decoration | undefined {
  const state = pluginKey.getState(view.state);
  if (!state?.contextState.selectedSuggestionId) return undefined;

  return findDecorationById(
    view,
    pluginKey,
    state.contextState.selectedSuggestionId,
  );
}
