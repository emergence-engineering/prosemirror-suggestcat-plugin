import { Decoration, EditorView } from "prosemirror-view";

import {
  GrammarSuggestDecorationSpec,
  GrammarSuggestElementClass,
} from "./types";

export const createUpdatePopup = (
  view: EditorView,
  decoration: Decoration,
  pos: number,
  applySuggestion: (view: EditorView, decoration: Decoration) => void,
  discardSuggestion: (view: EditorView, decoration: Decoration) => void,
) => {
  const root = document.createElement("div");
  root.className = "grammar-suggest-tooltip";
  const spec: GrammarSuggestDecorationSpec = decoration.spec;
  const boundingRect = view.dom.getBoundingClientRect();
  root.id = GrammarSuggestElementClass.grammarSuggestPopup;
  const coords = view.coordsAtPos(pos);
  root.style.left = coords.left - boundingRect.left + "px";
  root.style.top = coords.bottom - boundingRect.top + 5 + "px";

  const applyButton = document.createElement("div");
  applyButton.className = "grammar-suggest-tooltip-apply";
  applyButton.innerText = spec.text;
  applyButton.onclick = () => {
    applySuggestion(view, decoration);
  };
  root.appendChild(applyButton);

  const discardButton = document.createElement("div");
  discardButton.innerHTML =
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM12 10.5858L14.8284 7.75736L16.2426 9.17157L13.4142 12L16.2426 14.8284L14.8284 16.2426L12 13.4142L9.17157 16.2426L7.75736 14.8284L10.5858 12L7.75736 9.17157L9.17157 7.75736L12 10.5858Z'></path></svg>";

  discardButton.className = "grammar-suggest-tooltip-discard";

  discardButton.onclick = () => {
    discardSuggestion(view, decoration);
  };
  root.appendChild(discardButton);
  return root;
};
