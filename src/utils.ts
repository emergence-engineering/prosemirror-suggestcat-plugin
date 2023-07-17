import { PluginKey } from "prosemirror-state";
import { Node } from "prosemirror-model";
import diff from "fast-diff";

import {
  ChangedRegion,
  GrammarSuggestPluginState, OpenAiPromptsWithoutParam, OpenAiPromptsWithParam,
  TaskMeta,
} from "./types";

export const completePluginKey = new PluginKey("completePlugin");

export const isCompleteMeta = (meta: any): meta is TaskMeta => {
  return (
    Object.values(OpenAiPromptsWithParam).includes(meta.type) ||
    Object.values(OpenAiPromptsWithoutParam).includes(meta.type)
  );
};

export const grammarSuggestPluginKey = new PluginKey<GrammarSuggestPluginState>(
  "grammarSuggestPlugin",
);

export const getTextWithNewlines = (node: Node) => {
  let text = "";
  node.descendants((n, pos) => {
    if (n.isText) {
      text += `${n.text}\n`;
    }
  });
  return text;
};

const getLastChangePos = (oldText: string, changes: [number, string][]) => {
  const lastChange = changes[changes.length - 1];
  if (lastChange[0] !== diff.EQUAL) return oldText.length;
  const changesWithoutLast = changes.slice(0, changes.length - 1);
  let lastChangePos = 0;
  for (const change of changesWithoutLast) {
    const [type, text] = change;
    if (type === diff.EQUAL) {
      lastChangePos += text.length;
    }
    if (type === diff.DELETE) {
      lastChangePos += text.length;
    }
  }
  return lastChangePos;
};

// TODO: when enters are pressed the new paragraphs are not part of the region
// - Make a diff between the last stored text and the current one.
// - We get the end of the beginning identity and the start of the end identity.
// - Get the first & last newlines before the start and after the end.
export const getChangedRegions = (
  oldText: string,
  newText: string,
): ChangedRegion => {
  if (oldText === newText)
    return {
      start: oldText.length,
      end: oldText.length,
      oldStart: oldText.length,
      oldEnd: oldText.length,
      oldText: "",
      newText: "",
    };
  const changes = diff(oldText, newText);
  const fistChange = changes[0];
  const firstChangePos =
    fistChange[0] === diff.EQUAL ? fistChange[1].length - 1 : 0;
  const lastChangePos = getLastChangePos(oldText, changes);
  const firstNewlinePosFromFirstChange = oldText.lastIndexOf(
    "\n",
    firstChangePos,
  );
  const lastNewlinePosFromLastChange = oldText.indexOf("\n", lastChangePos);
  const oldStart =
    firstNewlinePosFromFirstChange === -1
      ? 0
      : firstNewlinePosFromFirstChange + 1;
  const oldEnd =
    lastNewlinePosFromLastChange === -1
      ? oldText.length
      : lastNewlinePosFromLastChange;
  // console.log({
  //   oldText,
  //   lastChangePos,
  //   lastNewlinePosFromLastChange,
  //   oldEnd,
  //   firstChangePos,
  //   firstNewlinePosFromFirstChange,
  //   oldStart,
  // });
  const oldChange = oldText.slice(oldStart, oldEnd);
  const newChange = newText.slice(
    oldStart,
    newText.length - (oldText.length - oldEnd),
  );
  return {
    start: oldStart,
    end: oldStart + newChange.length,
    oldStart,
    oldEnd,
    oldText: oldChange,
    newText: newChange,
  };
};
