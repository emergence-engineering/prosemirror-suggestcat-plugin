import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import { EditorState, Transaction } from "prosemirror-state";
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
import { yjsFactory } from "./yjs";

// add new decoration with suggestion coming from openAI
export const handleUpdate = (
  pluginState: GrammarSuggestPluginState,
  meta: UpdateSuggestionMeta,
  newState: EditorState,
  withYjs: boolean,
): GrammarSuggestPluginState => {
  // Add decorations
  const { changedRegion, fix, mapping, text } = meta;
  const factory = yjsFactory(newState);
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
        class: `grammarSuggestion ${
          replacement === "" ? "removalSuggestion" : ""
        }`,
      };

      let fromPos: any = decorationFrom;
      let toPos: any = decorationTo;

      if (withYjs) {
        fromPos = factory.getRelativePos(decorationFrom);
        toPos = factory.getRelativePos(decorationTo);
      }

      return {
        from: fromPos,
        to: toPos,
        spec,
      };
    });

  return {
    ...pluginState,
    decorations: [...pluginState.decorations, ...newDecorations],
    lastText: text,
  };
};

export const handleDocChange = (
  pluginState: GrammarSuggestPluginState,
  tr: Transaction,
  oldState: EditorState,
  newState: EditorState,
  withYjs: boolean,
): GrammarSuggestPluginState => {
  // Do it more efficiently. There's no need to calculate the whole mapping etc.
  const oldText = docToTextWithMapping(oldState.doc).text;
  const { text, mapping } = docToTextWithMapping(tr.doc);
  if (text === oldText) return pluginState;

  const changedRegion = getChangedRegions(oldText, text);

  const decorationsStart = textPosToDocPos(changedRegion.start, mapping);
  const decorationsEnd = textPosToDocPos(changedRegion.end, mapping);

  let mappedDecorations: Decoration[] = [];
  let decorations: Decoration[] = [];

  if (withYjs) {
    const factory = yjsFactory(newState);
    mappedDecorations = pluginState.decorations.map(
      factory.getDecoAbsolutePosition,
    );

    decorations = mappedDecorations
      .filter(
        (deco) =>
          !(deco?.from >= decorationsStart && deco.to <= decorationsEnd),
      )
      .map(factory.getDecoRelativePosition);
  } else {
    mappedDecorations = pluginState.decorations.map((deco) => ({
      ...deco,
      from: tr.mapping.map(deco.from),
      to: tr.mapping.map(deco.to),
    }));

    decorations = mappedDecorations.filter(
      (deco) => !(deco.from >= decorationsStart && deco.to <= decorationsEnd),
    );
  }

  const diffstart = tr.doc.content.findDiffStart(oldState.doc.content);
  const diffEnd = oldState.doc.content.findDiffEnd(tr.doc.content);
  const map =
    diffEnd && diffstart
      ? new StepMap([diffstart, diffEnd.a - diffstart, diffEnd.b - diffstart])
      : new StepMap([0, 0, 0]);

  const pmMapping = withYjs ? new Mapping([map]) : tr.mapping;

  const mappedPopupDecoration = pluginState.popupDecoration.map(
    pmMapping,
    tr.doc,
  );

  return {
    ...pluginState,
    decorations,
    popupDecoration: mappedPopupDecoration.remove(
      mappedPopupDecoration.find(decorationsStart, decorationsEnd),
    ),
  };
};

// after applying the suggestion, removes the decoration
export const handleAccept = (
  pluginState: GrammarSuggestPluginState,
  meta: AcceptSuggestionMeta,
  tr: Transaction,
  state: EditorState,
  withYjs: boolean,
): GrammarSuggestPluginState => {
  const factory = yjsFactory(state);

  const filtered = pluginState.decorations.filter(
    (deco) => deco.spec.id !== meta.id,
  );

  let decorations: Decoration[] = [];
  if (withYjs) {
    decorations = filtered
      .map(factory.getDecoAbsolutePosition)
      .map((deco) => ({
        ...deco,
        from: tr.mapping.map(deco.from),
        to: tr.mapping.map(deco.to),
      }))
      .map(factory.getDecoRelativePosition);
  } else {
    decorations = filtered.map((deco) => ({
      ...deco,
      from: tr.mapping.map(deco.from),
      to: tr.mapping.map(deco.to),
    }));
  }

  return {
    ...pluginState,
    lastText: getTextWithNewlines(tr.doc),
    decorations,
    popupDecoration: DecorationSet.empty,
  };
};

// callback for popup decoration
// inserts the suggestion to the doc replacing the original text
const applySuggestion =
  (withYjs: boolean) => (view: EditorView, decoration: Decoration) => {
    const pluginState = grammarSuggestPluginKey.getState(view.state);
    const currentDecoration = pluginState?.decorations.filter(
      (deco) => deco.spec.id === decoration.spec.id,
    )[0];

    if (!currentDecoration) return;
    const { text } = currentDecoration.spec as GrammarSuggestDecorationSpec;
    const { from, to } = currentDecoration;
    const meta: AcceptSuggestionMeta = {
      type: GrammarSuggestMetaType.acceptSuggestion,
      id: decoration.spec.id,
    };

    let fromPos: number | null = from;
    let toPos: number | null = to;

    if (withYjs) {
      const factory = yjsFactory(view.state);
      fromPos = factory.getAbsolutePos(from);
      toPos = factory.getAbsolutePos(to);
    }
    if (!fromPos || !toPos) return;

    const tr = view.state.tr
      .insertText(text, fromPos, toPos)
      .setMeta(grammarSuggestPluginKey, meta);
    view.dispatch(tr);
  };

// callback for popup decoration
const discardSuggestion = (view: EditorView, decoration: Decoration) => {
  const { spec } = decoration;
  const meta: DiscardSuggestionMeta = {
    type: GrammarSuggestMetaType.discardSuggestion,
    id: spec.id,
  };
  const tr = view.state.tr.setMeta(grammarSuggestPluginKey, meta);
  view.dispatch(tr);
};

// creates a popup decoration for the suggestion
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
            applySuggestion(options.withYjs),
            discardSuggestion,
          );
        },
        { ...spec, stopEvent: () => true },
      ),
    ]),
  };
};

// plugin's handleClick prop
export const handleClick = (
  view: EditorView,
  pos: number,
  withYjs: boolean,
) => {
  const pluginState = grammarSuggestPluginKey.getState(view.state);
  if (!pluginState) return false;
  const { decorations } = pluginState;

  // yjs
  let decoration: Decoration = decorations.filter(
    (deco) => deco.from <= pos && deco.to >= pos,
  )[0];

  if (withYjs) {
    const factory = yjsFactory(view.state);
    decoration = decorations
      .map(factory.getDecoAbsolutePosition)
      .filter((deco) => deco.from <= pos && deco.to >= pos)[0];
  }

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
    id: decoration.spec.id,
  };
  view.dispatch(view.state.tr.setMeta(grammarSuggestPluginKey, meta));
  return false;
};

// removes discarded decoration from the state
export const handleDiscardSuggestion = (
  pluginState: GrammarSuggestPluginState,
  meta: DiscardSuggestionMeta,
  tr: Transaction,
): GrammarSuggestPluginState => {
  return {
    ...pluginState,
    decorations: pluginState.decorations.filter(
      (deco) => deco.spec.id !== meta.id,
    ), // .map(tr.mapping, tr.doc),
    popupDecoration: DecorationSet.empty,
  };
};
