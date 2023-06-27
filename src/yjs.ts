import { EditorState } from "prosemirror-state";
import { Decoration } from "prosemirror-view";
import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
  ySyncPluginKey,
} from "y-prosemirror";
import { DecorationObject } from "./types";

export const yjsFactory = (state: EditorState) => {
  const YState = ySyncPluginKey.getState(state);

  const getDecoAbsolutePosition = (
    deco: DecorationObject,
  ): DecorationObject => {
    const posFrom = relativePositionToAbsolutePosition(
      YState.doc,
      YState.type,
      deco.from,
      YState.binding.mapping,
    );

    const posTo = relativePositionToAbsolutePosition(
      YState.doc,
      YState.type,
      deco.to,
      YState.binding.mapping,
    );
    return { ...deco, from: posFrom || deco.from, to: posTo || deco.to };
  };

  const getDecoRelativePosition = (
    deco: DecorationObject,
  ): DecorationObject => {
    const relPosFrom = absolutePositionToRelativePosition(
      deco.from,
      YState.type,
      YState.binding.mapping,
    );

    const relPosTo = absolutePositionToRelativePosition(
      deco.to,
      YState.type,
      YState.binding.mapping,
    );

    return { ...deco, from: relPosFrom, to: relPosTo };
  };

  const getRelativePos = (pos: number): any => {
    return absolutePositionToRelativePosition(
      pos,
      YState.type,
      YState.binding.mapping,
    );
  };

  const createInlineDecoFromRelativePos = (deco: DecorationObject) => {
    const posFrom = relativePositionToAbsolutePosition(
      YState.doc,
      YState.type,
      deco.from,
      YState.binding.mapping,
    );

    const posTo = relativePositionToAbsolutePosition(
      YState.doc,
      YState.type,
      deco.to,
      YState.binding.mapping,
    );

    return typeof posFrom === "number" && typeof posTo === "number"
      ? Decoration.inline(posFrom, posTo, { class: deco.spec.class }, deco.spec)
      : undefined;
  };

  return {
    getDecoAbsolutePosition,
    getDecoRelativePosition,
    getRelativePos,
    createInlineDecoFromRelativePos,
  };
};
