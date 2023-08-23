import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import { EditorState, TextSelection, Transaction } from "prosemirror-state";
import { Mapping, StepMap } from "prosemirror-transform";

import {
  AcceptSuggestionMeta,
  CloseSuggestionMeta,
  DiscardSuggestionMeta,
  GrammarSuggestDecorationSpec,
  GrammarSuggestMetaType,
  GrammarSuggestPluginOptions,
  GrammarSuggestPluginState,
  OpenSuggestionMeta,
  PopupDecorationSpec,
  UpdateSuggestionMeta,
} from "./types";
import {
  getChangedRegions,
  getTextWithNewlines,
  grammarSuggestPluginKey,
} from "./utils";
import { getDiff, isIdentity } from "./mergeDiffs";
import { docToTextWithMapping, textPosToDocPos } from "./mapping";
import { Fragment, Slice } from "prosemirror-model";

export const handleUpdate = (
  pluginState: GrammarSuggestPluginState,
  meta: UpdateSuggestionMeta,
  tr: Transaction,
): GrammarSuggestPluginState => {
  // Add decorations
  const { changedRegion, fix, mapping, text } = meta;
  const newDecorations = getDiff(changedRegion.newText, fix.result)
    .filter((i) => !isIdentity(i))
    .filter((i) => i.original !== `${i.replacement}\n`)
    .map(({ from, to, original, replacement }) => {
      const decorationFrom = textPosToDocPos(
        changedRegion.start + from,
        mapping,
      );
      const decorationTo = textPosToDocPos(
        changedRegion.start + (replacement.endsWith("\n") ? to - 1 : to),
        mapping,
      );
      const decorationText = replacement.endsWith("\n")
        ? replacement.slice(0, -1)
        : replacement;
      const spec: GrammarSuggestDecorationSpec = {
        text: decorationText,
        originalText: original,
        id: {},
      };

      return Decoration.inline(
        decorationFrom,
        decorationTo,
        {
          class: `grammarSuggestion ${
            replacement === "" ? "removalSuggestion" : ""
          }`,
        },
        spec,
      );
    });
  return {
    ...pluginState,
    decorations: pluginState.decorations.add(tr.doc, newDecorations),
    lastText: text,
  };
};

export const handleAccept = (
  pluginState: GrammarSuggestPluginState,
  meta: AcceptSuggestionMeta,
  tr: Transaction,
): GrammarSuggestPluginState => {
  const newDecorations = pluginState.decorations.remove(
    pluginState.decorations.find(
      0,
      tr.doc.nodeSize,
      (spec: GrammarSuggestDecorationSpec) => spec.id === meta.id,
    ),
  );
  return {
    ...pluginState,
    lastText: getTextWithNewlines(tr.doc),
    decorations: newDecorations.map(tr.mapping, tr.doc),
    popupDecoration: DecorationSet.empty,
  };
};

export const handleDocChange = (
  pluginState: GrammarSuggestPluginState,
  tr: Transaction,
  oldState: EditorState,
  withYjs: boolean,
): GrammarSuggestPluginState => {
  // Do it more efficiently. There's no need to calculate the whole mapping etc.
  const oldText = docToTextWithMapping(oldState.doc).text;
  const { text, mapping } = docToTextWithMapping(tr.doc);
  if (text === oldText) return pluginState;

  let pmMapping = tr.mapping;

  if (withYjs) {
    const diffStart = tr.doc.content.findDiffStart(oldState.doc.content);
    const diffEnd = oldState.doc.content.findDiffEnd(tr.doc.content);
    const map =
      diffEnd && diffStart
        ? new StepMap([diffStart, diffEnd.a - diffStart, diffEnd.b - diffStart])
        : new StepMap([0, 0, 0]);
    pmMapping = new Mapping([map]);
  }

  const changedRegion = getChangedRegions(oldText, text);
  const mappedDecorations = pluginState.decorations.map(pmMapping, tr.doc);
  const decorationsStart = textPosToDocPos(changedRegion.start, mapping);
  const decorationsEnd = textPosToDocPos(changedRegion.end, mapping);
  const mappedPopupDecoration = pluginState.popupDecoration.map(
    pmMapping,
    tr.doc,
  );

  return {
    ...pluginState,
    decorations: mappedDecorations.remove(
      mappedDecorations.find(decorationsStart, decorationsEnd),
    ),
    popupDecoration: mappedPopupDecoration.remove(
      mappedPopupDecoration.find(decorationsStart, decorationsEnd),
    ),
  };
};

const applySuggestion = (view: EditorView, decoration: Decoration) => {
  const currentDecoration = grammarSuggestPluginKey
    .getState(view.state)
    ?.decorations.find(
      0,
      view.state.doc.nodeSize,
      (spec: GrammarSuggestDecorationSpec) => spec.id === decoration.spec.id,
    )[0] as Decoration | undefined;
  if (!currentDecoration) return;
  const { text } = currentDecoration.spec as GrammarSuggestDecorationSpec;
  const { from, to } = currentDecoration;
  const meta: AcceptSuggestionMeta = {
    type: GrammarSuggestMetaType.acceptSuggestion,
    id: decoration.spec.id,
  };

  const paragraphs = text.split("\n");

  const paragraphNodes = paragraphs.map((paragraph) =>
    view.state.schema.node(
      "paragraph",
      null,
      view.state.schema.text(paragraph),
    ),
  );

  const fragment = Fragment.fromArray(paragraphNodes);

  let { tr } = view.state;
  tr = tr.setSelection(TextSelection.create(view.state.doc, from, to));

  tr.selection.replace(tr, new Slice(fragment, 1, 1));

  tr.setMeta(grammarSuggestPluginKey, meta);
  view.dispatch(tr);
};

const discardSuggestion = (view: EditorView, decoration: Decoration) => {
  const { spec } = decoration;
  const meta: DiscardSuggestionMeta = {
    type: GrammarSuggestMetaType.discardSuggestion,
    id: spec.id,
  };
  const tr = view.state.tr.setMeta(grammarSuggestPluginKey, meta);
  view.dispatch(tr);
};

export const handleOpenSuggestion = (
  pluginState: GrammarSuggestPluginState,
  meta: OpenSuggestionMeta,
  tr: Transaction,
  options: GrammarSuggestPluginOptions,
): GrammarSuggestPluginState => {
  const { decoration } = meta;
  const spec: PopupDecorationSpec = { id: decoration.spec.id };
  return {
    ...pluginState,
    popupDecoration: DecorationSet.create(tr.doc, [
      Decoration.widget(
        decoration.from,
        (view, getPos) => {
          const pos = getPos();
          if (!pos) return document.createElement("div");
          return options.createUpdatePopup(
            view,
            decoration,
            pos,
            applySuggestion,
            discardSuggestion,
          );
        },
        { ...spec, stopEvent: () => true },
      ),
    ]),
  };
};

export const handleClick = (view: EditorView, pos: number) => {
  const pluginState = grammarSuggestPluginKey.getState(view.state);
  if (!pluginState) return false;
  const { decorations } = pluginState;
  const decoration = decorations.find(pos, pos)[0] as Decoration | undefined;
  if (!decoration) {
    const meta: CloseSuggestionMeta = {
      type: GrammarSuggestMetaType.closeSuggestion,
    };
    view.dispatch(view.state.tr.setMeta(grammarSuggestPluginKey, meta));
    return false;
  }
  const popupDecoration = pluginState.popupDecoration.find()[0] as
    | Decoration
    | undefined;
  if (popupDecoration?.spec.id === decoration.spec.id) return false;
  const meta: OpenSuggestionMeta = {
    type: GrammarSuggestMetaType.openSuggestion,
    decoration,
  };
  view.dispatch(view.state.tr.setMeta(grammarSuggestPluginKey, meta));
  return false;
};

export const handleDiscardSuggestion = (
  pluginState: GrammarSuggestPluginState,
  meta: DiscardSuggestionMeta,
  tr: Transaction,
): GrammarSuggestPluginState => {
  return {
    ...pluginState,
    decorations: pluginState.decorations.remove(
      pluginState.decorations.find(
        0,
        tr.doc.nodeSize,
        (spec: GrammarSuggestDecorationSpec) => spec.id === meta.id,
      ),
    ),
    popupDecoration: DecorationSet.empty,
  };
};
