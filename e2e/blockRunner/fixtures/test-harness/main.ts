import { EditorState } from "prosemirror-state";
import { EditorView, Decoration } from "prosemirror-view";
import { Schema, DOMParser } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { exampleSetup } from "prosemirror-example-setup";

import {
  blockRunnerPlugin,
  createBlockRunnerKey,
  ActionType,
  RunnerStatus,
  UnitStatus,
  dispatchAction,
} from "../../../../src/blockRunner";
import type {
  RunnerState,
  MetadataSpec,
  ProcessingUnit,
  ResultDecoration,
} from "../../../../src/blockRunner/types";

import {
  createMockProcessor,
  createMockProcessorControls,
  resolveUnit,
  rejectUnit,
  resolveAllPending,
  getPendingKeys,
  getUnitKey,
  type TestMetadata,
  type TestResponse,
  type MockProcessorControls,
} from "./mock-processor";

// Create plugin key
const testPluginKey = createBlockRunnerKey<TestResponse, {}, TestMetadata>("test-runner");

// Create mock processor controls
const mockControls = createMockProcessorControls();

// Decoration factory - creates simple inline decorations
function testDecorationFactory(
  response: TestResponse,
  unit: ProcessingUnit<TestMetadata>,
): ResultDecoration<TestResponse>[] {
  const id = {};
  return [
    Decoration.inline(unit.from + 1, unit.to - 1, {
      class: "test-decoration",
      "data-message": response.message,
    }, {
      id,
      unitId: unit.id,
      originalText: unit.text,
      response,
    }) as ResultDecoration<TestResponse>,
  ];
}

// Widget factory - creates loading widgets at the start of each processing unit
function testWidgetFactory(unit: ProcessingUnit<TestMetadata>): Decoration | undefined {
  // Create a widget at the start of the unit
  const widget = document.createElement("span");
  widget.className = `test-widget test-widget-${unit.status.toLowerCase()}`;
  widget.setAttribute("data-unit-status", unit.status);
  widget.setAttribute("data-unit-from", String(unit.from));
  widget.setAttribute("data-unit-to", String(unit.to));
  widget.textContent = `[${unit.status}]`;

  return Decoration.widget(unit.from, widget, {
    unitId: unit.id,
    status: unit.status,
    side: -1, // Position before the content
  });
}

// Create editor schema
const schema = new Schema({
  nodes: basicSchema.spec.nodes,
  marks: basicSchema.spec.marks,
});

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
    blockRunnerPlugin<TestResponse, {}, TestMetadata>({
      pluginKey: testPluginKey,
      unitProcessor: createMockProcessor(mockControls),
      decorationFactory: testDecorationFactory,
      widgetFactory: testWidgetFactory,
      initialContextState: {},
      options: {
        batchSize: 2,
        maxRetries: 3,
        backoffBase: 100, // Lower backoff for faster tests
        dirtyHandling: {
          shouldRecalculate: true,
          debounceDelay: 100, // Lower delay for faster tests
        },
      },
    }),
  ];

  const state = EditorState.create({
    doc,
    plugins,
  });

  return new EditorView(editorElement, { state });
}

// Decoration detail info for testing
interface DecorationDetail {
  from: number;
  to: number;
  id: object;
  unitId: object;
  message: string;
  originalText: string;
}

// Widget detail info for testing
interface WidgetDetail {
  pos: number;
  unitId: object;
  status: UnitStatus;
  unitFrom: number;
  unitTo: number;
}

// Test Bridge - exposed on window for Playwright to control
interface TestBridge {
  // State inspection
  getPluginState: () => RunnerState<TestResponse, {}, TestMetadata> | undefined;
  getStatus: () => RunnerStatus | undefined;
  getUnits: () => ProcessingUnit<TestMetadata>[] | undefined;
  getUnitStatuses: () => Map<string, UnitStatus>;
  getDecorations: () => ResultDecoration<TestResponse>[];
  getUnitCount: () => number;
  getUnitCountByStatus: (status: UnitStatus) => number;
  getDecorationDetails: () => DecorationDetail[];
  getSelectedDecoration: () => object | undefined;
  getWidgetDetails: () => WidgetDetail[];
  getWidgetCount: () => number;

  // Mock processor controls
  mockProcessor: {
    getPendingKeys: () => string[];
    getPendingCount: () => number;
    resolveUnit: (key: string, message?: string) => boolean;
    rejectUnit: (key: string, errorMessage?: string) => boolean;
    resolveAllPending: (message?: string) => number;
    getProcessingCalls: () => number;
    resetCalls: () => void;
  };

  // Action dispatching
  dispatch: {
    init: (metadata?: MetadataSpec<TestMetadata>) => void;
    finish: () => void;
    clear: () => void;
    resume: () => void;
    removeDecoration: (id: object) => void;
    selectDecoration: (id: object) => void;
    deselectDecoration: () => void;
  };

  // Editor helpers
  editor: {
    getView: () => EditorView;
    getDocText: () => string;
    typeText: (text: string) => void;
    insertTextAt: (pos: number, text: string) => void;
    deleteRange: (from: number, to: number) => void;
    focus: () => void;
    performSelfCall: (from: number, to: number, replacement: string, actionType: string, actionPayload: object) => void;
  };

  // Async helpers
  waitForStatus: (status: RunnerStatus, timeout?: number) => Promise<void>;
  waitForUnitCount: (count: number, status: UnitStatus, timeout?: number) => Promise<void>;
  waitForPendingCount: (count: number, timeout?: number) => Promise<void>;
  waitForProcessingCalls: (count: number, timeout?: number) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
}

// Create the test bridge
function createTestBridge(view: EditorView): TestBridge {
  const getState = () => testPluginKey.getState(view.state);

  return {
    // State inspection
    getPluginState: getState,

    getStatus: () => getState()?.status,

    getUnits: () => {
      const state = getState();
      return state?.unitsInProgress;
    },

    getUnitStatuses: () => {
      const units = getState()?.unitsInProgress ?? [];
      const statusMap = new Map<string, UnitStatus>();
      for (const unit of units) {
        statusMap.set(getUnitKey(unit), unit.status);
      }
      return statusMap;
    },

    getDecorations: () => getState()?.decorations ?? [],

    getUnitCount: () => getState()?.unitsInProgress?.length ?? 0,

    getUnitCountByStatus: (status: UnitStatus) => {
      const units = getState()?.unitsInProgress ?? [];
      return units.filter((u) => u.status === status).length;
    },

    getDecorationDetails: () => {
      const decorations = getState()?.decorations ?? [];
      return decorations.map((d) => ({
        from: d.from,
        to: d.to,
        id: d.spec.id,
        unitId: d.spec.unitId,
        message: d.spec.response?.message ?? "",
        originalText: d.spec.originalText,
      }));
    },

    getSelectedDecoration: () => getState()?.selected,

    getWidgetDetails: () => {
      // Widgets are created for units that are not DONE and not ERROR
      const units = getState()?.unitsInProgress ?? [];
      return units
        .filter((u) => u.status !== UnitStatus.DONE && u.status !== UnitStatus.ERROR)
        .map((u) => ({
          pos: u.from, // Widget is created at unit.from
          unitId: u.id,
          status: u.status,
          unitFrom: u.from,
          unitTo: u.to,
        }));
    },

    getWidgetCount: () => {
      const units = getState()?.unitsInProgress ?? [];
      return units.filter((u) => u.status !== UnitStatus.DONE && u.status !== UnitStatus.ERROR).length;
    },

    // Mock processor controls
    mockProcessor: {
      getPendingKeys: () => getPendingKeys(mockControls),
      getPendingCount: () => mockControls.pendingUnits.size,
      resolveUnit: (key: string, message?: string) => resolveUnit(mockControls, key, message),
      rejectUnit: (key: string, errorMessage?: string) => rejectUnit(mockControls, key, errorMessage),
      resolveAllPending: (message?: string) => resolveAllPending(mockControls, message),
      getProcessingCalls: () => mockControls.processingCalls,
      resetCalls: () => { mockControls.processingCalls = 0; },
    },

    // Action dispatching
    dispatch: {
      init: (metadata?: MetadataSpec<TestMetadata>) => {
        dispatchAction(view, testPluginKey, {
          type: ActionType.INIT,
          metadata: metadata ?? { single: {} },
        });
      },
      finish: () => {
        dispatchAction(view, testPluginKey, { type: ActionType.FINISH });
      },
      clear: () => {
        dispatchAction(view, testPluginKey, { type: ActionType.CLEAR });
      },
      resume: () => {
        dispatchAction(view, testPluginKey, { type: ActionType.RESUME });
      },
      removeDecoration: (id: object) => {
        dispatchAction(view, testPluginKey, { type: ActionType.REMOVE_DECORATION, id });
      },
      selectDecoration: (id: object) => {
        dispatchAction(view, testPluginKey, { type: ActionType.SELECT_DECORATION, id });
      },
      deselectDecoration: () => {
        dispatchAction(view, testPluginKey, { type: ActionType.DESELECT_DECORATION });
      },
    },

    // Editor helpers
    editor: {
      getView: () => view,
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
      performSelfCall: (from: number, to: number, replacement: string, actionType: string, actionPayload: object) => {
        // Create a transaction that includes both a text change and a plugin meta
        // This simulates what acceptSuggestion does
        let tr = view.state.tr;

        // Replace text (or insert if from === to)
        if (from === to) {
          tr = tr.insertText(replacement, from);
        } else {
          tr = tr.insertText(replacement, from, to);
        }

        // Add the plugin action meta
        const action = { type: ActionType[actionType as keyof typeof ActionType], ...actionPayload };
        tr = tr.setMeta(testPluginKey, action);

        view.dispatch(tr);
      },
    },

    // Async helpers
    waitForStatus: async (status: RunnerStatus, timeout = 5000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (getState()?.status === status) return;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw new Error(`Timeout waiting for status ${status}`);
    },

    waitForUnitCount: async (count: number, status: UnitStatus, timeout = 5000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const units = getState()?.unitsInProgress ?? [];
        const matching = units.filter((u) => u.status === status).length;
        if (matching >= count) return;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw new Error(`Timeout waiting for ${count} units with status ${status}`);
    },

    waitForPendingCount: async (count: number, timeout = 5000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (mockControls.pendingUnits.size >= count) return;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw new Error(`Timeout waiting for ${count} pending units`);
    },

    waitForProcessingCalls: async (count: number, timeout = 5000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (mockControls.processingCalls >= count) return;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw new Error(`Timeout waiting for ${count} processing calls`);
    },

    sleep: (ms: number) => new Promise((r) => setTimeout(r, ms)),
  };
}

// Declare global type for TypeScript
declare global {
  interface Window {
    __BLOCK_RUNNER_TEST__: TestBridge;
    __editorView: EditorView;
  }
}

// Initialize on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  const view = createEditor();
  const bridge = createTestBridge(view);

  // Expose on window
  window.__BLOCK_RUNNER_TEST__ = bridge;
  window.__editorView = view;

  console.log("BlockRunner test harness initialized");
  console.log("Access via window.__BLOCK_RUNNER_TEST__");
});
