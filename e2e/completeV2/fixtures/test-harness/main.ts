import { EditorState, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Schema, DOMParser } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { exampleSetup } from "prosemirror-example-setup";

import {
  completePluginV2,
  completeV2Key,
  startTask,
  acceptResult,
  rejectResult,
  cancelTask,
  setEnabled,
  clearError,
  getCompleteState,
} from "../../../../src/completeV2";
import {
  CompleteStatus,
  CompleteV2State,
  TaskType,
  TaskParams,
  AiPromptsWithoutParam,
  AiPromptsWithParam,
} from "../../../../src/completeV2/types";

import {
  mockControls,
  resetMock,
  setResponseChunks,
  setError,
  getRequests,
  getLastRequest,
  getRequestCount,
  resolveStream,
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
    completePluginV2("test-api-key", {
      maxSelection: 1000,
    }),
  ];

  const state = EditorState.create({
    doc,
    plugins,
  });

  return new EditorView(editorElement, { state });
}

// Update status display
function updateStatusDisplay(state: CompleteV2State | undefined): void {
  const statusDisplay = document.getElementById("status-display");
  if (!statusDisplay || !state) return;

  statusDisplay.innerHTML = `
    <div>Status: <span class="status status-${state.status}">${state.status}</span></div>
    <div>Task: ${state.taskType ?? "none"}</div>
    <div>Enabled: ${state.enabled}</div>
    <div>Error: ${state.error ?? "none"}</div>
    <div>Result length: ${state.streamedResult.length}</div>
  `;

  // Show/hide preview panel
  const preview = document.getElementById("preview");
  if (preview) {
    if (state.status === CompleteStatus.PREVIEW || state.status === CompleteStatus.STREAMING) {
      preview.classList.add("visible");
      const content = preview.querySelector(".preview-content");
      if (content) {
        content.textContent = state.streamedResult || "(streaming...)";
      }
    } else {
      preview.classList.remove("visible");
    }
  }
}

// Test Bridge - exposed on window for Playwright to control
interface CompleteV2TestBridge {
  // State inspection
  getStatus(): CompleteStatus;
  getTaskType(): TaskType | undefined;
  getParams(): TaskParams | undefined;
  getStreamedResult(): string;
  getError(): string | undefined;
  isEnabled(): boolean;
  getState(): CompleteV2State | undefined;

  // Mock API controls
  mockApi: {
    setResponse(chunks: string[]): void;
    setError(error: string): void;
    getRequestCount(): number;
    getLastRequest(): { task: string; params?: object; text: string } | undefined;
    getAllRequests(): { task: string; params?: object; text: string }[];
    resolveStream(): void;
    reset(): void;
    setAutoResolve(auto: boolean): void;
    setChunkDelay(ms: number): void;
  };

  // Actions
  actions: {
    startTask(taskType: string, params?: TaskParams): void;
    acceptResult(): void;
    rejectResult(): void;
    cancelTask(): void;
    setEnabled(enabled: boolean): void;
    clearError(): void;
  };

  // Editor
  editor: {
    getDocText(): string;
    setSelection(from: number, to: number): void;
    typeText(text: string): void;
    focus(): void;
    getSelectionRange(): { from: number; to: number };
  };

  // Async helpers
  waitForStatus(status: string, timeout?: number): Promise<void>;
  waitForStreamChunks(minLength: number, timeout?: number): Promise<void>;
  waitForRequestCount(count: number, timeout?: number): Promise<void>;
  sleep(ms: number): Promise<void>;
}

// Create the test bridge
function createTestBridge(view: EditorView): CompleteV2TestBridge {
  const getState = () => getCompleteState(view);

  return {
    // State inspection
    getStatus: () => getState()?.status ?? CompleteStatus.IDLE,
    getTaskType: () => getState()?.taskType,
    getParams: () => getState()?.params,
    getStreamedResult: () => getState()?.streamedResult ?? "",
    getError: () => getState()?.error,
    isEnabled: () => getState()?.enabled ?? false,
    getState: () => getState(),

    // Mock API controls
    mockApi: {
      setResponse: (chunks: string[]) => setResponseChunks(chunks),
      setError: (error: string) => setError(error),
      getRequestCount: () => getRequestCount(),
      getLastRequest: () => {
        const req = getLastRequest();
        return req ? { task: req.task, params: req.params, text: req.text } : undefined;
      },
      getAllRequests: () => getRequests().map((r) => ({ task: r.task, params: r.params, text: r.text })),
      resolveStream: () => resolveStream(),
      reset: () => resetMock(),
      setAutoResolve: (auto: boolean) => { mockControls.autoResolve = auto; },
      setChunkDelay: (ms: number) => { mockControls.chunkDelay = ms; },
    },

    // Actions
    actions: {
      startTask: (taskType: string, params?: TaskParams) => {
        const task = (AiPromptsWithoutParam[taskType as keyof typeof AiPromptsWithoutParam]
          ?? AiPromptsWithParam[taskType as keyof typeof AiPromptsWithParam]) as TaskType;
        startTask(view, task, params);
      },
      acceptResult: () => acceptResult(view),
      rejectResult: () => rejectResult(view),
      cancelTask: () => cancelTask(view),
      setEnabled: (enabled: boolean) => setEnabled(view, enabled),
      clearError: () => clearError(view),
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
      setSelection: (from: number, to: number) => {
        const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to));
        view.dispatch(tr);
      },
      typeText: (text: string) => {
        const { from } = view.state.selection;
        const tr = view.state.tr.insertText(text, from);
        view.dispatch(tr);
      },
      focus: () => {
        view.focus();
      },
      getSelectionRange: () => {
        const { from, to } = view.state.selection;
        return { from, to };
      },
    },

    // Async helpers
    waitForStatus: async (status: string, timeout = 5000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (getState()?.status === status) return;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw new Error(`Timeout waiting for status ${status}, current: ${getState()?.status}`);
    },

    waitForStreamChunks: async (minLength: number, timeout = 5000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const result = getState()?.streamedResult ?? "";
        if (result.length >= minLength) return;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw new Error(`Timeout waiting for ${minLength} chars, got: ${getState()?.streamedResult?.length ?? 0}`);
    },

    waitForRequestCount: async (count: number, timeout = 5000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (getRequestCount() >= count) return;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw new Error(`Timeout waiting for ${count} requests, got: ${getRequestCount()}`);
    },

    sleep: (ms: number) => new Promise((r) => setTimeout(r, ms)),
  };
}

// Declare global type for TypeScript
declare global {
  interface Window {
    __COMPLETE_V2_TEST__: CompleteV2TestBridge;
    __editorView: EditorView;
  }
}

// Initialize on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  editorView = createEditor();
  const bridge = createTestBridge(editorView);

  // Expose on window
  window.__COMPLETE_V2_TEST__ = bridge;
  window.__editorView = editorView;

  // Set up preview panel HTML
  const preview = document.getElementById("preview");
  if (preview) {
    preview.innerHTML = `
      <div class="preview-header">Preview</div>
      <div class="preview-content"></div>
      <div class="preview-actions">
        <button class="accept" onclick="window.__COMPLETE_V2_TEST__.actions.acceptResult()">Accept</button>
        <button class="reject" onclick="window.__COMPLETE_V2_TEST__.actions.rejectResult()">Reject</button>
      </div>
    `;
  }

  // Watch for state changes to update display
  const originalDispatch = editorView.dispatch.bind(editorView);
  editorView.dispatch = (tr) => {
    originalDispatch(tr);
    updateStatusDisplay(getCompleteState(editorView));
  };

  // Initial status update
  updateStatusDisplay(getCompleteState(editorView));

  console.log("CompleteV2 test harness initialized");
  console.log("Access via window.__COMPLETE_V2_TEST__");
});
