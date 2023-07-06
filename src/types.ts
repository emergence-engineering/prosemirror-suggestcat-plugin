import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import { TextSelection } from "prosemirror-state";

export type TextMappingItem = {
  docPos: number;
  textPos: number;
};

export interface ChangedRegion {
  oldStart: number;
  oldEnd: number;
  start: number;
  end: number;
  oldText: string;
  newText: string;
}

export type GrammarSuggestPluginState = {
  lastText?: string;
  timer?: number;
  decorations: DecorationSet;
  popupDecoration: DecorationSet;
  currentSuggestionId?: object;
};
export type GrammarSuggestPluginOptions = {
  debounceMs: number;
  createUpdatePopup: (
    view: EditorView,
    decoration: Decoration,
    pos: number,
    applySuggestion: (view: EditorView, decoration: Decoration) => void,
    discardSuggestion: (view: EditorView, decoration: Decoration) => void,
  ) => HTMLElement;
};

export enum GrammarSuggestMetaType {
  suggestionUpdate = "suggestionUpdate",
  acceptSuggestion = "acceptSuggestion",
  openSuggestion = "openSuggestion",
  closeSuggestion = "closeSuggestion",
  discardSuggestion = "discardSuggestion",
}

export interface AcceptSuggestionMeta {
  type: GrammarSuggestMetaType.acceptSuggestion;
  id: object;
}

export type FixMistakeResultData = {
  result: string;
  fixed: boolean;
  mod?: {
    original: string;
    fixed: string;
    position: number;
    type: string;
  }[];
};

export interface UpdateSuggestionMeta {
  type: GrammarSuggestMetaType.suggestionUpdate;
  fix: FixMistakeResultData;
  changedRegion: ChangedRegion;
  mapping: TextMappingItem[];
  text: string;
}

export interface OpenSuggestionMeta {
  type: GrammarSuggestMetaType.openSuggestion;
  decoration: Decoration;
}

export interface DiscardSuggestionMeta {
  type: GrammarSuggestMetaType.discardSuggestion;
  id: object;
}

export interface CloseSuggestionMeta {
  type: GrammarSuggestMetaType.closeSuggestion;
}

export type GrammarPluginMeta =
  | UpdateSuggestionMeta
  | AcceptSuggestionMeta
  | OpenSuggestionMeta
  | CloseSuggestionMeta
  | DiscardSuggestionMeta;

export type GrammarSuggestDecorationSpec = {
  originalText: string;
  text: string;
  id: object; // TODO: Maybe not needed?
};

export type PopupDecorationSpec = {
  id: object; // The same id as the suggestion
};

export enum GrammarSuggestElementClass {
  grammarSuggestPopup = "grammar-suggest-popup",
}

export enum TaskType {
  complete = "Complete",
  makeLonger = "MakeLonger",
  makeShorter = "MakeShorter",
}

export enum Status {
  idle = "idle",
  new = "new",
  streaming = "streaming",
  finished = "finished",
  accepted = "accepted",
  rejected = "rejected",
  done = "done",
  error = "error",
}

export interface CompletePluginState {
  type?: TaskType;
  status?: Status;
  result?: string;
  selection?: TextSelection;
  error?: string;
}

export interface TaskMeta {
  type: TaskType;
  status: Status.new | Status.accepted | Status.rejected;
}

export interface DefaultCompleteOptions {
  maxSelection: number;
}
