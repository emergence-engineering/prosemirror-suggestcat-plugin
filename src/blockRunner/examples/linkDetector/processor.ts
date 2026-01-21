import { EditorView } from "prosemirror-view";
import { ProcessingUnit, UnitProcessorResult } from "../../types";
import { LinkDetectorMetadata, LinkDetectorResponse, LinkMatch } from "./types";

// URL regex pattern - matches http:// and https:// URLs
const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/g;

// Detect links in text
function detectLinks(text: string): LinkMatch[] {
  const matches: LinkMatch[] = [];
  let match: RegExpExecArray | null;

  while ((match = URL_REGEX.exec(text)) !== null) {
    matches.push({
      url: match[0],
      from: match.index,
      to: match.index + match[0].length,
    });
  }

  return matches;
}

// Unit processor for link detection
export const linkDetectorProcessor = async (
  _view: EditorView,
  unit: ProcessingUnit<LinkDetectorMetadata>,
): Promise<UnitProcessorResult<LinkDetectorResponse>> => {
  const links = detectLinks(unit.text);
  return { data: links };
};
