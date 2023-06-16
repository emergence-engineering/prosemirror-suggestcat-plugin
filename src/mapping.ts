import { Node } from "prosemirror-model";
import { TextMappingItem } from "./types";

const defaultMapping = [{ docPos: 1, textPos: 0 }];

export const docToTextWithMapping = (
  doc: Node,
): { text: string; mapping: TextMappingItem[] } => {
  let text = "";
  const mapping: TextMappingItem[] = [];
  doc.descendants((node, pos) => {
    if (node.isText) {
      mapping.push({ docPos: pos, textPos: text.length });
      text += `${node.text}\n`;
    }
  });
  return { text, mapping: mapping.length ? mapping : defaultMapping };
};
export const textPosToDocPos = (
  textPos: number,
  mapping: TextMappingItem[],
) => {
  for (let i = 0; i < mapping.length; i++) {
    if (
      textPos >= mapping[i].textPos &&
      (mapping[i + 1] === undefined || textPos < mapping[i + 1].textPos)
    ) {
      return mapping[i].docPos + (textPos - mapping[i].textPos);
    }
  }
  throw new Error(
    "textPositionToDocumentPosition: textPos not found in mapping",
  );
};
