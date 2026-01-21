import { EditorState } from "prosemirror-state";
import { EditorView, Decoration } from "prosemirror-view";
import { Schema, DOMParser } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { exampleSetup } from "prosemirror-example-setup";

import {
  grammarSuggestPluginV2,
  grammarSuggestV2Key,
  acceptSuggestion,
  discardSuggestion,
  selectSuggestion,
  deselectSuggestion,
  getSelectedDecoration,
} from "../../../../src/grammarSuggestV2";
import {
  GrammarDecorationSpec,
  GrammarFixResult,
} from "../../../../src/grammarSuggestV2/types";
import {
  dispatchAction,
  ActionType,
  RunnerStatus,
  UnitStatus,
} from "../../../../src/blockRunner";

import {
  mockControls,
  resetMock,
  setResponse,
  setDefaultResponse,
  setError,
  getRequests,
  getRequestCount,
  getPendingRequests,
  resolveRequest,
  resolveAll,
  installMockFetch,
} from "./mock-api";

// Install mock fetch immediately
installMockFetch();

// Create editor schema
const schema = new Schema({
  nodes: basicSchema.spec.nodes,
  marks: basicSchema.spec.marks,
});

// Global editor view reference
let editorView: EditorView;

// Initialize editor
function createEditor(): EditorView {
  const contentElement = document.getElementById("content");
  const editorElement = document.getElementById("editor");

  if (!contentElement || !editorElement) {
    throw new Error("Missing editor or content element");
  }

  const doc = DOMParser.fromSchema(schema).parse(contentElement);

  const plugins = [
    ...exampleSetup({ schema, menuBar: false }),
    grammarSuggestPluginV2("test-api-key", {
      batchSize: 2,
      maxRetries: 3,
      backoffBase: 100,
    }),
  ];

  const state = EditorState.create({
    doc,
    plugins,
  });

  return new EditorView(editorElement, { state });
}

// Decoration info for tests
interface DecorationInfo {
  from: number;
  to: number;
  id: object;
  unitId: object;
  originalText: string;
  replacement: string;
}

// Update status display
function updateStatusDisplay(view: EditorView): void {
  const statusDisplay = document.getElementById("status-display");
  if (!statusDisplay) return;

  const state = grammarSuggestV2Key.getState(view.state);
  if (!state) {
    statusDisplay.innerHTML = "Plugin state unavailable";
    return;
  }

  const decorations = state.decorations ?? [];
  const unitsInProgress = state.unitsInProgress ?? [];
  const decorationCount = decorations.length;
  const unitCount = unitsInProgress.length;
  const queuedCount = unitsInProgress.filter((u) => u.status === UnitStatus.QUEUED).length;
  const processingCount = unitsInProgress.filter((u) => u.status === UnitStatus.PROCESSING).length;
  const doneCount = unitsInProgress.filter((u) => u.status === UnitStatus.DONE).length;
  const errorCount = unitsInProgress.filter((u) => u.status === UnitStatus.ERROR).length;

  statusDisplay.innerHTML = `
    <div>Status: ${state.status}</div>
    <div>Decorations: ${decorationCount}</div>
    <div>Units: ${unitCount} (queued: ${queuedCount}, processing: ${processingCount}, done: ${doneCount}, error: ${errorCount})</div>
    <div>Selected: ${state.contextState.selectedSuggestionId ? "yes" : "no"}</div>
  `;
}

// Test Bridge - exposed on window for Playwright to control
interface GrammarV2TestBridge {
  // State inspection
  getDecorations(): DecorationInfo[];
  getSelectedDecorationId(): object | undefined;
  getRunnerStatus(): string;
  getProcessingStatus(): { queued: number; processing: number; done: number; error: number };
  getUnitCount(): number;

  // Mock API controls
  mockApi: {
    setResponse(text: string, result: { fixed: boolean; result: string }): void;
    setDefaultResponse(result: { fixed: boolean; result: string }): void;
    setError(error: string): void;
    getPendingRequests(): string[];
    resolveRequest(text: string): boolean;
    resolveAll(): void;
    getRequestCount(): number;
    getAllRequests(): Array<{ text: string }>;
    reset(): void;
    setAutoResolve(auto: boolean): void;
    setResponseDelay(ms: number): void;
  };

  // Actions
  actions: {
    init(): void;
    finish(): void;
    clear(): void;
    acceptSuggestion(decorationIndex: number): void;
    discardSuggestion(decorationIndex: number): void;
    selectSuggestion(decorationIndex: number): void;
    deselectSuggestion(): void;
  };

  // Editor
  editor: {
    getDocText(): string;
    typeText(text: string): void;
    insertTextAt(pos: number, text: string): void;
    deleteRange(from: number, to: number): void;
    focus(): void;
  };

  // Async helpers
  waitForDecorations(count: number, timeout?: number): Promise<void>;
  waitForProcessingComplete(timeout?: number): Promise<void>;
  waitForStatus(status: string, timeout?: number): Promise<void>;
  waitForUnitCount(count: number, status: string, timeout?: number): Promise<void>;
  sleep(ms: number): Promise<void>;
}

// Create the test bridge
function createTestBridge(view: EditorView): GrammarV2TestBridge {
  const getState = () => grammarSuggestV2Key.getState(view.state);

  return {
    // State inspection
    getDecorations: () => {
      const state = getState();
      if (!state) return [];
      return state.decorations.map((d) => {
        const spec = d.spec as unknown as GrammarDecorationSpec;
        return {
          from: d.from,
          to: d.to,
          id: spec.id,
          unitId: spec.unitId,
          originalText: spec.originalText,
          replacement: spec.replacement,
        };
      });
    },

    getSelectedDecorationId: () => {
      return getState()?.contextState.selectedSuggestionId;
    },

    getRunnerStatus: () => {
      return getState()?.status ?? "IDLE";
    },

    getProcessingStatus: () => {
      const units = getState()?.unitsInProgress ?? [];
      return {
        queued: units.filter((u) => u.status === UnitStatus.QUEUED).length,
        processing: units.filter((u) => u.status === UnitStatus.PROCESSING).length,
        done: units.filter((u) => u.status === UnitStatus.DONE).length,
        error: units.filter((u) => u.status === UnitStatus.ERROR).length,
      };
    },

    getUnitCount: () => {
      return getState()?.unitsInProgress.length ?? 0;
    },

    // Mock API controls
    mockApi: {
      setResponse: (text: string, result: { fixed: boolean; result: string }) => {
        setResponse(text, result);
      },
      setDefaultResponse: (result: { fixed: boolean; result: string }) => {
        setDefaultResponse(result);
      },
      setError: (error: string) => setError(error),
      getPendingRequests: () => getPendingRequests(),
      resolveRequest: (text: string) => resolveRequest(text),
      resolveAll: () => resolveAll(),
      getRequestCount: () => getRequestCount(),
      getAllRequests: () => getRequests().map((r) => ({ text: r.text })),
      reset: () => resetMock(),
      setAutoResolve: (auto: boolean) => { mockControls.autoResolve = auto; },
      setResponseDelay: (ms: number) => { mockControls.responseDelay = ms; },
    },

    // Actions
    actions: {
      init: () => {
        dispatchAction(view, grammarSuggestV2Key, {
          type: ActionType.INIT,
          metadata: { single: { paragraphIndex: 0 } },
        });
      },
      finish: () => {
        dispatchAction(view, grammarSuggestV2Key, { type: ActionType.FINISH });
      },
      clear: () => {
        dispatchAction(view, grammarSuggestV2Key, { type: ActionType.CLEAR });
      },
      acceptSuggestion: (decorationIndex: number) => {
        const state = getState();
        if (!state || decorationIndex >= state.decorations.length) return;
        const decoration = state.decorations[decorationIndex];
        const spec = decoration.spec as unknown as GrammarDecorationSpec;
        acceptSuggestion(view, grammarSuggestV2Key, spec.id);
      },
      discardSuggestion: (decorationIndex: number) => {
        const state = getState();
        if (!state || decorationIndex >= state.decorations.length) return;
        const decoration = state.decorations[decorationIndex];
        const spec = decoration.spec as unknown as GrammarDecorationSpec;
        discardSuggestion(view, grammarSuggestV2Key, spec.id);
      },
      selectSuggestion: (decorationIndex: number) => {
        const state = getState();
        if (!state || decorationIndex >= state.decorations.length) return;
        const decoration = state.decorations[decorationIndex];
        const spec = decoration.spec as unknown as GrammarDecorationSpec;
        selectSuggestion(view, grammarSuggestV2Key, spec.id);
      },
      deselectSuggestion: () => {
        deselectSuggestion(view, grammarSuggestV2Key);
      },
    },

    // Editor
    editor: {
      getDocText: () => {
        let text = "";
        view.state.doc.descendants((node) => {
          if (node.isText) {
            text += node.text;
          } else if (node.isBlock && text.length > 0) {
            text += "\n";
          }
        });
        return text;
      },
      typeText: (text: string) => {
        const { from } = view.state.selection;
        const tr = view.state.tr.insertText(text, from);
        view.dispatch(tr);
      },
      insertTextAt: (pos: number, text: string) => {
        const tr = view.state.tr.insertText(text, pos);
        view.dispatch(tr);
      },
      deleteRange: (from: number, to: number) => {
        const tr = view.state.tr.delete(from, to);
        view.dispatch(tr);
      },
      focus: () => {
        view.focus();
      },
    },

    // Async helpers
    waitForDecorations: async (count: number, timeout = 5000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const state = getState();
        if (state && state.decorations.length >= count) return;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw new Error(`Timeout waiting for ${count} decorations, got: ${getState()?.decorations.length ?? 0}`);
    },

    waitForProcessingComplete: async (timeout = 5000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const state = getState();
        if (state) {
          const hasProcessing = state.unitsInProgress.some(
            (u) => u.status === UnitStatus.QUEUED || u.status === UnitStatus.PROCESSING,
          );
          if (!hasProcessing) return;
        }
        await new Promise((r) => setTimeout(r, 50));
      }
      throw new Error("Timeout waiting for processing to complete");
    },

    waitForStatus: async (status: string, timeout = 5000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (getState()?.status === status) return;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw new Error(`Timeout waiting for status ${status}, got: ${getState()?.status}`);
    },

    waitForUnitCount: async (count: number, status: string, timeout = 5000) => {
      const start = Date.now();
      const statusEnum = UnitStatus[status as keyof typeof UnitStatus];
      while (Date.now() - start < timeout) {
        const units = getState()?.unitsInProgress ?? [];
        const matching = units.filter((u) => u.status === statusEnum).length;
        if (matching >= count) return;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw new Error(`Timeout waiting for ${count} units with status ${status}`);
    },

    sleep: (ms: number) => new Promise((r) => setTimeout(r, ms)),
  };
}

// Declare global type for TypeScript
declare global {
  interface Window {
    __GRAMMAR_V2_TEST__: GrammarV2TestBridge;
    __editorView: EditorView;
  }
}

// Initialize on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  editorView = createEditor();
  const bridge = createTestBridge(editorView);

  // Expose on window
  window.__GRAMMAR_V2_TEST__ = bridge;
  window.__editorView = editorView;

  // Watch for state changes to update display
  const originalDispatch = editorView.dispatch.bind(editorView);
  editorView.dispatch = (tr) => {
    originalDispatch(tr);
    updateStatusDisplay(editorView);
  };

  // Initial status update
  updateStatusDisplay(editorView);

  console.log("GrammarSuggestV2 test harness initialized");
  console.log("Access via window.__GRAMMAR_V2_TEST__");
});
