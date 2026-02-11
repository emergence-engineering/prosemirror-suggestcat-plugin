import { Node } from "prosemirror-model";
import { EditorState, PluginKey, Transaction } from "prosemirror-state";
import { Decoration, EditorView } from "prosemirror-view";
import { Mapping, StepMap } from "prosemirror-transform";
import {
  Action,
  ActionType,
  BlockRunnerTextMapping,
  ExtractedText,
  ProcessingUnit,
  ProgressInfo,
  ResultDecoration,
  RunnerOptions,
  RunnerState,
  RunnerStateActive,
  RunnerStatus,
  UnitRange,
  UnitStatus,
} from "./types";

// Extract text with position mapping from document
export function extractTextWithMapping(
  doc: Node,
  from: number,
  to: number,
): ExtractedText {
  const mapping: BlockRunnerTextMapping[] = [];
  let text = "";
  let textPos = 0;

  doc.nodesBetween(from, to, (node, pos) => {
    if (node.isText && node.text) {
      const start = Math.max(from, pos);
      const end = Math.min(to, pos + node.nodeSize);
      const content = node.text.slice(start - pos, end - pos);

      mapping.push({ from: textPos, docPos: start });
      text += content;
      textPos += content.length;
    } else if (node.isBlock && text.length > 0) {
      // Add newline for block boundaries
      mapping.push({ from: textPos, docPos: pos });
      text += "\n";
      textPos += 1;
    }
  });

  return { text, mapping };
}

// Convert text position back to document position
export function textToDocPos(
  textPos: number,
  mapping: BlockRunnerTextMapping[],
): number {
  for (let i = mapping.length - 1; i >= 0; i--) {
    if (mapping[i].from <= textPos) {
      return mapping[i].docPos + (textPos - mapping[i].from);
    }
  }
  return mapping[0]?.docPos ?? 0;
}

// Get all units (paragraphs/headers/etc) in a range
export function getUnitsInRange(
  doc: Node,
  from: number,
  to: number,
  nodeTypes: string | string[] = "paragraph",
): UnitRange[] {
  const types = Array.isArray(nodeTypes) ? nodeTypes : [nodeTypes];
  const units: UnitRange[] = [];

  doc.nodesBetween(from, to, (node, pos) => {
    if (types.includes(node.type.name)) {
      const nodeEnd = pos + node.nodeSize;
      const extracted = extractTextWithMapping(doc, pos, nodeEnd);
      if (extracted.text.trim().length > 0) {
        units.push({
          from: pos,
          to: nodeEnd,
          ...extracted,
        });
      }
    }
  });

  return units;
}

const mapDecorationArray = <D extends Decoration>(
  decorationArray: D[],
  mapping: Mapping,
): D[] => {
  return decorationArray
    .map(
      (deco) =>
        // @ts-expect-error the `Decoration.map` is internal
        deco?.map(mapping, 0, 0),
    )
    .filter((deco): deco is D => deco !== null);
};

export const fixYjsMappings = (
  tr: Transaction,
  editorState: EditorState,
): undefined | { end: number; mapping: Mapping; start: number } => {
  const diffStart = tr.doc.content.findDiffStart(editorState.doc.content);
  const diffEnd = editorState.doc.content.findDiffEnd(tr.doc.content);
  if (!diffEnd || !diffStart) return undefined;
  // We can't use the mapping from the tr since YJS collab messes that up
  let map = new StepMap([0, 0, 0]);
  let start = diffStart;
  let end = diffEnd.a;
  if (diffEnd && diffStart) {
    /*
    Here we avoid negative size values when we manually create a mapping.
    A mapping is a [start, size, new size] tuple. PM handles really "interestingly" the negative size values,
      so we need to avoid them.
    For some reason diffStart and diffEnd can produce cases,
      where we can have negative size values if we just blindly subtract them
     */
    if (diffEnd.a < diffStart) {
      start = diffEnd.a;
      end = diffEnd.b;
      map = new StepMap([diffEnd.a, 0, diffEnd.b - diffEnd.a]);
    } else if (diffEnd.b < diffStart) {
      start = diffEnd.b;
      end = diffEnd.a;
      map = new StepMap([diffEnd.b, diffEnd.a - diffEnd.b, 0]);
    } else {
      map = new StepMap([
        diffStart,
        diffEnd.a - diffStart,
        diffEnd.b - diffStart,
      ]);
    }
  }
  return {
    end,
    mapping: new Mapping([map]),
    start,
  };
};

// Remap positions after document change
export function remapPositions<ResponseType, ContextState, UnitMetadata>(
  state: RunnerState<ResponseType, ContextState, UnitMetadata>,
  tr: Transaction,
  editorState: EditorState,
  options: RunnerOptions<ResponseType, ContextState, UnitMetadata>,
  skipDirtyMarking = false,
): RunnerState<ResponseType, ContextState, UnitMetadata> {
  const fixedMappings = fixYjsMappings(tr, editorState);
  if (!fixedMappings) return state;
  const { start, end, mapping: pmMapping } = fixedMappings;
  const nodeTypes = Array.isArray(options.nodeTypes)
    ? options.nodeTypes
    : [options.nodeTypes];

  const waitUntil = Date.now() + options.dirtyHandling.debounceDelay;

  const nodes = state.unitsInProgress?.slice().sort((a, b) => a.from - b.from);
  if (nodes) {
    const newNodes: ProcessingUnit<UnitMetadata>[] = [];
    const nodesFrom = pmMapping.map(nodes[0].from);
    const nodesTo = pmMapping.map(nodes[nodes.length - 1].to);
    const helperNodes = getUnitsInRange(tr.doc, nodesFrom, nodesTo, nodeTypes);
    for (const idx in nodes) {
      const node = nodes[idx];
      const refNode = helperNodes[idx];
      if (refNode) {
        let { status } = node;
        // Only mark as DIRTY if not skipping dirty marking (i.e., not a self-change)
        if (!skipDirtyMarking && refNode.from <= end && refNode.to >= start) {
          status = UnitStatus.DIRTY;
        }
        newNodes.push({
          ...node,
          status,
          // Only update waitUntil if we're marking dirty
          waitUntil: skipDirtyMarking ? node.waitUntil : waitUntil,
          ...refNode,
        });
      } else {
        newNodes.push({
          ...node,
          status: UnitStatus.DONE,
          from: nodesTo,
          to: nodesTo,
        });
      }
    }
    return {
      ...state,
      unitsInProgress: newNodes,
      decorations: mapDecorationArray(state.decorations, pmMapping),
    };
  }

  return {
    ...state,
    decorations: mapDecorationArray(state.decorations, pmMapping),
  };
}

// Calculate exponential backoff delay
export function calculateBackoff(retryCount: number, baseMs: number): number {
  return (baseMs / 1000) ** retryCount * 1000;
}

// Get progress info from state
export function getProgress<ResponseType, ContextState, UnitMetadata>(
  state: RunnerState<ResponseType, ContextState, UnitMetadata>,
): ProgressInfo {
  if (state.status !== RunnerStatus.ACTIVE) {
    return { completed: 0, total: 0, decorations: state.decorations.length };
  }

  const units = state.unitsInProgress ?? [];
  const completed = units.filter(
    (u) => u.status === UnitStatus.DONE || u.status === UnitStatus.ERROR,
  ).length;

  return {
    completed,
    total: units.length,
    decorations: state.decorations.length,
  };
}

// Sleep utility
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Dispatch an action to the plugin
export function dispatchAction<
  ResponseType = unknown,
  ContextState = unknown,
  UnitMetadata = unknown,
>(
  view: EditorView,
  pluginKey: PluginKey,
  action: Action<ResponseType, ContextState, UnitMetadata>,
): void {
  view.dispatch(view.state.tr.setMeta(pluginKey, action));
}

// Get unit by ID from state
export function getUnitById<ResponseType, ContextState, UnitMetadata>(
  pluginKey: PluginKey<RunnerState<ResponseType, ContextState, UnitMetadata>>,
  state: RunnerState<ResponseType, ContextState, UnitMetadata>,
  unitId: object,
): ProcessingUnit<UnitMetadata> | undefined {
  if (state.status !== RunnerStatus.ACTIVE) return undefined;
  return state.unitsInProgress.find((u) => u.id === unitId);
}

// Update a unit in state (helper for state handlers)
export function updateUnit<ResponseType, ContextState, UnitMetadata>(
  state: RunnerStateActive<ResponseType, ContextState, UnitMetadata>,
  unitId: object,
  updates: Partial<ProcessingUnit<UnitMetadata>>,
): RunnerStateActive<ResponseType, ContextState, UnitMetadata> {
  const unitsInProgress = state.unitsInProgress.map((unit) =>
    unit.id === unitId ? { ...unit, ...updates } : unit,
  );

  // Sort by waitUntil when it's modified, so selectNextUnit picks optimal blocking unit
  if ("waitUntil" in updates) {
    unitsInProgress.sort((a, b) => a.waitUntil - b.waitUntil);
  }

  return { ...state, unitsInProgress };
}

// Check if all units are finished (DONE or ERROR)
export function allUnitsFinished<UnitMetadata>(
  units: ProcessingUnit<UnitMetadata>[],
): boolean {
  return units.every(
    (u) => u.status === UnitStatus.DONE || u.status === UnitStatus.ERROR,
  );
}

// Create initial processing units from document
export function createUnitsFromDocument<UnitMetadata>(
  doc: Node,
  from: number,
  to: number,
  metadataFactory: (unit: UnitRange, index: number) => UnitMetadata,
  nodeTypes: string | string[] = "paragraph",
): ProcessingUnit<UnitMetadata>[] {
  const ranges = getUnitsInRange(doc, from, to, nodeTypes);

  return ranges.map((range, index) => ({
    id: {},
    status: UnitStatus.QUEUED,
    from: range.from,
    to: range.to,
    text: range.text,
    mapping: range.mapping,
    metadata: metadataFactory(range, index),
    retryCount: 0,
    waitUntil: 0,
  }));
}

// Pause the runner (uses FINISH to transition to IDLE while preserving units)
export function pauseRunner<ResponseType, ContextState, UnitMetadata>(
  view: EditorView,
  pluginKey: PluginKey<RunnerState<ResponseType, ContextState, UnitMetadata>>,
): void {
  dispatchAction(view, pluginKey, { type: ActionType.FINISH });
}

// Resume a paused runner
export function resumeRunner<ResponseType, ContextState, UnitMetadata>(
  view: EditorView,
  pluginKey: PluginKey<RunnerState<ResponseType, ContextState, UnitMetadata>>,
): void {
  dispatchAction(view, pluginKey, { type: ActionType.RESUME });
}

// Check if runner can be resumed (is IDLE with pending units)
export function canResume<ResponseType, ContextState, UnitMetadata>(
  state: RunnerState<ResponseType, ContextState, UnitMetadata>,
): boolean {
  return (
    state.status === RunnerStatus.IDLE &&
    !!state.unitsInProgress?.some(
      (u) => u.status !== UnitStatus.DONE && u.status !== UnitStatus.ERROR,
    )
  );
}
