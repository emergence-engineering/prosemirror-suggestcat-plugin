import { EditorView } from "prosemirror-view";
import { Decoration } from "prosemirror-view";
import { AIModel } from "../api/config";

// Single grammar suggestion within a paragraph
export interface GrammarSuggestion {
  from: number; // text position within paragraph
  to: number; // text position within paragraph
  original: string;
  replacement: string;
}

// Response from processing a paragraph
export interface GrammarFixResult {
  fixed: boolean;
  originalText: string;
  fixedText: string;
  suggestions: GrammarSuggestion[];
}

// Context state for the plugin
export interface GrammarContextState {
  selectedSuggestionId?: object; // For popup highlighting
}

// Unit metadata per paragraph
export interface GrammarUnitMetadata {
  paragraphIndex: number;
}

// Plugin options
export interface GrammarSuggestV2Options {
  apiKey: string;
  apiEndpoint?: string;
  model?: string | AIModel;
  batchSize?: number; // Default: 2
  maxRetries?: number; // Default: 3
  backoffBase?: number; // Default: 2000
  debounceMs?: number; // Default: 1000
  createPopup?: (
    view: EditorView,
    decoration: Decoration,
    pos: number,
    applySuggestion: () => void,
    discardSuggestion: () => void,
    requestHint: () => Promise<string>,
  ) => HTMLElement;
}

// Decoration spec for grammar suggestions
export interface GrammarDecorationSpec {
  id: object;
  unitId: object;
  originalText: string;
  replacement: string;
  response: GrammarFixResult;
}
