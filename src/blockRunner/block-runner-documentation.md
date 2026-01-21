# Block-Based Runner Architecture Documentation

## Overview

The **Block-Based Runner** is a TypeScript/ProseMirror plugin system that processes document content (paragraphs, sentences, or custom blocks) through a parallel pipeline of workers. It manages state transitions, applies visual decorations (highlights) to the editor, and handles retry logic with exponential backoff.

Think of it as a **task queue processor** that operates on text blocks within a rich text editor.

---

## Architecture Diagram

```
┌─────────────────────────────────────┐
│      Editor (Tiptap/ProseMirror)    │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────────────────┐
│         blockRunnerExtension (Creates Extension & Plugin)               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │  State Management (state.ts)                                 │        │
│  │  - RunnerState (IDLE | ACTIVE)                              │        │
│  │  - ProcessingUnit[] with status lifecycle                   │        │
│  │  - ResultDecorations (visual highlights)                    │        │
│  │  - contextState (custom per-implementation)                 │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                          ▲                    │                          │
│                          │                    ▼                          │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │  Execution Loop (executor.ts)                               │        │
│  │  - executeParallel: Spawns batchSize concurrent workers     │        │
│  │  - selectNextUnit: Selects by priority/status              │        │
│  │  - processUnit: Executes analysis on each unit             │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                          ▲                    │                          │
│                          │                    ▼                          │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │  Implementations (processors/)                               │        │
│  │  - TextAnalysisProcessor (AI-based)                         │        │
│  │  - LengthAnalysisProcessor                                  │        │
│  │  - ComplexityProcessor                                      │        │
│  └─────────────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Type Definitions

### RunnerState (Plugin State)

Two variants based on status:

```typescript
enum RunnerStatus {
  IDLE = "IDLE",
  ACTIVE = "ACTIVE",
}

// When idle - no processing
interface RunnerStateIdle<ContextState> {
  status: RunnerStatus.IDLE
  decorations: ResultDecoration[]
  selected: object | undefined
  contextState: ContextState
  options: RunnerOptions
}

// When active - processing units
interface RunnerStateActive<ContextState, UnitMetadata> {
  status: RunnerStatus.ACTIVE
  unitsInProgress: ProcessingUnit<UnitMetadata>[]
  decorations: ResultDecoration[]
  selected: object | undefined
  contextState: ContextState
  options: RunnerOptions
}

type RunnerState<ContextState, UnitMetadata> =
  | RunnerStateIdle<ContextState>
  | RunnerStateActive<ContextState, UnitMetadata>
```

### ProcessingUnit (Work Unit)

Represents a block of text to be processed:

```typescript
enum UnitStatus {
  DIRTY = "DIRTY",           // Text changed, needs re-run
  WAITING = "WAITING",       // Queued but not yet selected
  QUEUED = "QUEUED",         // Selected, ready to process
  PROCESSING = "PROCESSING", // Currently running
  DONE = "DONE",             // Successfully completed
  BACKOFF = "BACKOFF",       // Failed, waiting before retry
  ERROR = "ERROR",           // Max retries exceeded
}

interface ProcessingUnit<ResponseType, UnitMetadata> {
  id: object                          // Unique identifier (use {} for uniqueness)
  status: UnitStatus
  from: number                        // Start position in document
  to: number                          // End position in document
  text: string                        // Text content to process
  mapping: TextMappingItem[]          // Maps text positions to doc positions
  metadata: UnitMetadata              // Custom data per implementation
  retryCount: number                  // Failed attempts
  waitUntil: number                   // Backoff deadline (ms timestamp)
  response?: ResponseType             // Result (only when DONE)
}

// Text mapping for position translation
interface TextMappingItem {
  from: number    // Position in text
  docPos: number  // Position in document
}
```

### ResultDecoration (Decoration)

Visual highlight in the editor:

```typescript
interface ResultDecorationSpec<ResponseType> {
  id: object                    // Unique decoration ID
  unitId: object                // Which unit created it
  originalText: string          // Full text being highlighted
  response: ResponseType        // Analysis result
  // ... any custom fields
}

// ResultDecoration extends ProseMirror's Decoration
interface ResultDecoration extends Decoration {
  spec: ResultDecorationSpec
}
```

### RunnerOptions (Configuration)

```typescript
interface RunnerOptions<ResponseType, ContextState, UnitMetadata> {
  // Filtering & Prioritization
  priorityFilter: (unit: ProcessingUnit, contextState: ContextState) => boolean
  visibilityFilter: (decoration: ResultDecoration, contextState: ContextState) => boolean
  getGroupId: (unit: ProcessingUnit) => string  // For batching by type

  // Execution Control
  batchSize: number               // Parallel workers (default: 4)
  maxRetries: number              // Retry limit (default: 3)
  backoffBase: number             // Initial retry delay ms (default: 1000)

  dirtyHandling: {
    shouldRecalculate: boolean    // Reprocess on text change
    debounceDelay: number         // Delay before reprocessing (ms)
  }

  // UI Callbacks
  forceRerender: () => void       // Trigger UI update
  onUpdate?: (state: RunnerState) => void  // State change callback
}
```

### Action Types (Meta Dispatch)

```typescript
enum ActionType {
  INIT = "INIT",
  FINISH = "FINISH",
  CLEAR = "CLEAR",
  UNIT_STARTED = "UNIT_STARTED",
  UNIT_SUCCESS = "UNIT_SUCCESS",
  UNIT_ERROR = "UNIT_ERROR",
  UPDATE_CONTEXT = "UPDATE_CONTEXT",
  REMOVE_DECORATION = "REMOVE_DECORATION",
  SELECT_DECORATION = "SELECT_DECORATION",
  DESELECT_DECORATION = "DESELECT_DECORATION",
}

// Example meta payloads
interface InitAction {
  type: ActionType.INIT
  onlySelection?: boolean  // Only process selected range
  metadata: {
    // One of these three:
    single?: UnitMetadata
    array?: UnitMetadata[]
    factory?: (unit: ProcessingUnit) => UnitMetadata
  }
}

interface UnitSuccessAction<ResponseType> {
  type: ActionType.UNIT_SUCCESS
  unitId: object
  response: ResponseType
}

interface UnitErrorAction {
  type: ActionType.UNIT_ERROR
  unitId: object
  error: Error
}
```

---

## 2. Core State Machine

### Status Lifecycle

```
Document Edit
     │
     ▼
┌─────────────┐
│   DIRTY     │  ← Text changed while not processing
└──────┬──────┘
       │ INIT dispatched
       ▼
┌─────────────┐
│   WAITING   │  ← Queued but priorityFilter returns false
└──────┬──────┘
       │ priorityFilter returns true
       ▼
┌─────────────┐
│   QUEUED    │  ← Ready to be picked up by worker
└──────┬──────┘
       │ Worker picks it up
       ▼
┌─────────────┐
│ PROCESSING  │  ← unitProcessor running
└──────┬──────┘
       │
   ┌───┴───┐
   ▼       ▼
┌──────┐ ┌─────────┐
│ DONE │ │ BACKOFF │  ← Error, retries left
└──────┘ └────┬────┘
              │ waitUntil elapsed
              ▼
         ┌─────────┐
         │ QUEUED  │  ← Retry
         └────┬────┘
              │ maxRetries exceeded
              ▼
         ┌─────────┐
         │  ERROR  │  ← Final failure
         └─────────┘
```

### State Handler Functions

```typescript
// Pure function - returns new state, doesn't mutate
function handleAction<R, C, M>(
  state: RunnerState<C, M>,
  action: Action,
  decorationFactory: DecorationFactory<R, M>
): RunnerState<C, M> {
  switch (action.type) {
    case ActionType.INIT:
      return initializeUnits(state, action)

    case ActionType.UNIT_SUCCESS:
      return handleUnitSuccess(state, action, decorationFactory)

    case ActionType.UNIT_ERROR:
      return handleUnitError(state, action)

    case ActionType.FINISH:
      return { ...state, status: RunnerStatus.IDLE, unitsInProgress: undefined }

    case ActionType.CLEAR:
      return { ...state, decorations: [], status: RunnerStatus.IDLE }

    case ActionType.UPDATE_CONTEXT:
      return { ...state, contextState: action.contextState }

    case ActionType.REMOVE_DECORATION:
      return { ...state, decorations: state.decorations.filter(d => d.spec.id !== action.id) }

    default:
      return state
  }
}
```

---

## 3. Execution Engine

### Parallel Executor

```typescript
async function executeParallel<R, C, M>(
  pluginKey: PluginKey,
  view: EditorView,
  unitProcessor: UnitProcessor<R, M>,
  options: RunnerOptions<R, C, M>
): Promise<void> {
  // Spawn batchSize concurrent workers
  const workers = Array.from(
    { length: options.batchSize },
    () => executeLoop(pluginKey, view, unitProcessor, options)
  )
  await Promise.all(workers)
}

async function executeLoop<R, C, M>(
  pluginKey: PluginKey,
  view: EditorView,
  unitProcessor: UnitProcessor<R, M>,
  options: RunnerOptions<R, C, M>
): Promise<boolean> {
  const didProcess = await processNext(pluginKey, view, unitProcessor, options)

  if (didProcess) {
    // Recursively process next unit
    return executeLoop(pluginKey, view, unitProcessor, options)
  }

  return false // No more units
}
```

### Unit Selection Strategy

```typescript
function selectNextUnit<C, M>(
  state: RunnerState<C, M>,
  options: RunnerOptions
): ProcessingUnit<M> | undefined {
  const now = Date.now()
  const units = state.unitsInProgress ?? []

  const isReady = (u: ProcessingUnit) =>
    [UnitStatus.QUEUED, UnitStatus.BACKOFF, UnitStatus.DIRTY].includes(u.status) &&
    u.waitUntil <= now

  const isBlocking = (u: ProcessingUnit) =>
    [UnitStatus.QUEUED, UnitStatus.BACKOFF, UnitStatus.DIRTY].includes(u.status) &&
    u.waitUntil > now

  // Priority order:
  // 1. Ready units matching priority filter
  const priorityReady = units.find(u => isReady(u) && options.priorityFilter(u, state.contextState))
  if (priorityReady) return priorityReady

  // 2. Any ready unit
  const anyReady = units.find(isReady)
  if (anyReady) return anyReady

  // 3. Blocking unit (will sleep until ready)
  const blocking = units.find(isBlocking)
  if (blocking) return blocking

  return undefined
}
```

### Single Unit Processing

```typescript
async function processNext<R, C, M>(
  pluginKey: PluginKey,
  view: EditorView,
  unitProcessor: UnitProcessor<R, M>,
  options: RunnerOptions<R, C, M>
): Promise<boolean> {
  const state = pluginKey.getState(view.state)
  if (state.status !== RunnerStatus.ACTIVE) return false

  const unit = selectNextUnit(state, options)
  if (!unit) return false

  // Mark as PROCESSING
  dispatchAction(view, pluginKey, {
    type: ActionType.UNIT_STARTED,
    unitId: unit.id,
  })

  // Wait for backoff if needed
  const freshUnit = getUnitById(pluginKey, view.state, unit.id)
  if (freshUnit.waitUntil > Date.now()) {
    await sleep(freshUnit.waitUntil - Date.now())

    // Check if still active after sleeping
    const currentState = pluginKey.getState(view.state)
    if (currentState.status !== RunnerStatus.ACTIVE) return false
  }

  try {
    // Execute the processor
    const response = await unitProcessor(view, freshUnit)

    if (response.error) {
      dispatchAction(view, pluginKey, {
        type: ActionType.UNIT_ERROR,
        unitId: unit.id,
        error: response.error,
      })
    } else {
      dispatchAction(view, pluginKey, {
        type: ActionType.UNIT_SUCCESS,
        unitId: unit.id,
        response: response.data,
      })
    }
  } catch (error) {
    dispatchAction(view, pluginKey, {
      type: ActionType.UNIT_ERROR,
      unitId: unit.id,
      error,
    })
  }

  return true
}
```

### Backoff Strategy

```typescript
function calculateBackoff(retryCount: number, baseMs: number): number {
  // Exponential backoff: base^retryCount
  return Math.pow(baseMs / 1000, retryCount) * 1000
}

function handleUnitError<C, M>(
  state: RunnerState<C, M>,
  action: UnitErrorAction,
  options: RunnerOptions
): RunnerState<C, M> {
  const unit = state.unitsInProgress?.find(u => u.id === action.unitId)
  if (!unit) return state

  const newRetryCount = unit.retryCount + 1

  if (newRetryCount >= options.maxRetries) {
    // Final failure
    return updateUnit(state, unit.id, {
      status: UnitStatus.ERROR,
      retryCount: newRetryCount,
    })
  }

  // Schedule retry with backoff
  return updateUnit(state, unit.id, {
    status: UnitStatus.BACKOFF,
    retryCount: newRetryCount,
    waitUntil: Date.now() + calculateBackoff(newRetryCount, options.backoffBase),
  })
}
```

---

## 4. Base Extension Factory

```typescript
function blockRunnerExtension<ResponseType, ContextState, UnitMetadata>(
  name: string,
  pluginKey: PluginKey,
  decorationFactory: DecorationFactory<ResponseType, UnitMetadata>,
  decorationTransformer: DecorationTransformer<ResponseType, ContextState> | undefined,
  widgetFactory: WidgetFactory<UnitMetadata> | undefined,
  unitProcessor: UnitProcessor<ResponseType, UnitMetadata>,
  initialContextState: ContextState,
  options: Partial<RunnerOptions<ResponseType, ContextState, UnitMetadata>>,
  handlers?: { handleKeyDown?: KeyHandler }
): Extension {
  const mergedOptions = { ...defaultOptions, ...options }

  return Extension.create({
    name,

    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: pluginKey,

          state: {
            init(): RunnerState<ContextState, UnitMetadata> {
              return {
                status: RunnerStatus.IDLE,
                decorations: [],
                selected: undefined,
                contextState: initialContextState,
                options: mergedOptions,
              }
            },

            apply(tr, state): RunnerState<ContextState, UnitMetadata> {
              // Handle document changes - remap positions
              if (tr.docChanged) {
                state = remapPositions(state, tr)
              }

              // Handle dispatched actions
              const action = tr.getMeta(pluginKey)
              if (action) {
                return handleAction(state, action, decorationFactory)
              }

              return state
            },
          },

          props: {
            decorations(editorState): DecorationSet {
              const state = pluginKey.getState(editorState)

              // Filter visible decorations
              let decorations = state.decorations.filter(d =>
                mergedOptions.visibilityFilter(d, state.contextState)
              )

              // Transform decorations (e.g., highlight selected)
              if (decorationTransformer) {
                decorations = decorationTransformer(decorations, state)
              }

              // Add loading widgets for processing units
              const widgets: Decoration[] = []
              if (state.status === RunnerStatus.ACTIVE && widgetFactory) {
                for (const unit of state.unitsInProgress ?? []) {
                  if (unit.status !== UnitStatus.DONE) {
                    const widget = widgetFactory(unit)
                    if (widget) widgets.push(widget)
                  }
                }
              }

              return DecorationSet.create(editorState.doc, [...decorations, ...widgets])
            },

            handleKeyDown: handlers?.handleKeyDown,
          },

          view() {
            let isRunning = false

            return {
              update(view) {
                const state = pluginKey.getState(view.state)

                if (state.status === RunnerStatus.ACTIVE && !isRunning) {
                  isRunning = true

                  executeParallel(pluginKey, view, unitProcessor, mergedOptions)
                    .finally(() => {
                      isRunning = false
                      // Dispatch FINISH when all done
                      dispatchAction(view, pluginKey, { type: ActionType.FINISH })
                    })
                }
              },
            }
          },
        }),
      ]
    },
  })
}
```

---

## 5. Creating an Implementation

### Step 1: Define Types

```typescript
// Response from your processor
interface AnalysisResponse {
  issues: Array<{
    start: number
    end: number
    message: string
    suggestion?: string
  }>
}

// Custom metadata for each unit
interface AnalysisMetadata {
  analysisType: string
  language: string
}

// Context state for the runner
interface AnalysisContextState {
  selectedTypes: string[]
  threshold: number
}
```

### Step 2: Create Unit Processor

```typescript
const analysisProcessor: UnitProcessor<AnalysisResponse, AnalysisMetadata> =
  async (view, unit) => {
    try {
      // Call your API or run local analysis
      const result = await analyzeText({
        text: unit.text,
        type: unit.metadata.analysisType,
        language: unit.metadata.language,
      })

      return { data: result, error: undefined }
    } catch (error) {
      return { data: undefined, error }
    }
  }
```

### Step 3: Create Decoration Factory

```typescript
const analysisDecorationFactory: DecorationFactory<AnalysisResponse, AnalysisMetadata> =
  (response, unit) => {
    return response.issues.map(issue => {
      // Map text position to document position
      const fromPos = unit.from + textToDocPos(issue.start, unit.mapping)
      const toPos = unit.from + textToDocPos(issue.end, unit.mapping)

      return Decoration.inline(
        fromPos,
        toPos,
        { class: "analysis-highlight" },
        {
          id: {},  // Unique object reference
          unitId: unit.id,
          originalText: unit.text,
          response: issue,
        }
      )
    })
  }
```

### Step 4: Create Decoration Transformer (Optional)

```typescript
const analysisDecorationTransformer: DecorationTransformer<AnalysisResponse, AnalysisContextState> =
  (decorations, state) => {
    const selected = state.selected

    return decorations.map(decoration => {
      if (selected && decoration.spec.id === selected) {
        // Highlight selected decoration
        return recreateWithClass(decoration, "analysis-highlight--selected")
      }
      return decoration
    })
  }
```

### Step 5: Create Widget Factory (Optional)

```typescript
const analysisWidgetFactory: WidgetFactory<AnalysisMetadata> = (unit) => {
  if (unit.status === UnitStatus.PROCESSING) {
    return Decoration.widget(unit.from, () => {
      const el = document.createElement("span")
      el.className = "loading-indicator"
      el.innerHTML = "⏳"
      return el
    })
  }

  if (unit.status === UnitStatus.ERROR) {
    return Decoration.widget(unit.from, () => {
      const el = document.createElement("span")
      el.className = "error-indicator"
      el.innerHTML = "❌"
      return el
    })
  }

  return undefined
}
```

### Step 6: Create the Extension

```typescript
export const AnalysisExtension = (config: { language: string; forceRerender: () => void }) =>
  blockRunnerExtension<AnalysisResponse, AnalysisContextState, AnalysisMetadata>(
    "analysisRunner",
    analysisPluginKey,
    analysisDecorationFactory,
    analysisDecorationTransformer,
    analysisWidgetFactory,
    analysisProcessor,
    // Initial context state
    { selectedTypes: [], threshold: 0.5 },
    // Options
    {
      batchSize: 4,
      maxRetries: 3,
      backoffBase: 1000,
      priorityFilter: (unit, ctx) => ctx.selectedTypes.includes(unit.metadata.analysisType),
      visibilityFilter: (decoration, ctx) => ctx.selectedTypes.includes(decoration.spec.response.type),
      forceRerender: config.forceRerender,
    }
  )
```

### Step 7: Activate/Deactivate

```typescript
// Start processing
function activateAnalysis(view: EditorView, types: string[]) {
  view.dispatch(
    view.state.tr.setMeta(analysisPluginKey, {
      type: ActionType.INIT,
      metadata: {
        factory: (unit) => ({
          analysisType: types[0],  // Or logic to determine type
          language: "en",
        }),
      },
    })
  )

  // Update context with selected types
  view.dispatch(
    view.state.tr.setMeta(analysisPluginKey, {
      type: ActionType.UPDATE_CONTEXT,
      contextState: { selectedTypes: types, threshold: 0.5 },
    })
  )
}

// Stop processing
function deactivateAnalysis(view: EditorView) {
  view.dispatch(
    view.state.tr.setMeta(analysisPluginKey, { type: ActionType.CLEAR })
  )
}
```

---

## 6. Position Mapping

Handle document changes without losing decoration positions:

```typescript
interface TextMappingItem {
  from: number    // Character position in extracted text
  docPos: number  // Corresponding position in document
}

// Extract text with mapping
function extractTextWithMapping(
  doc: Node,
  from: number,
  to: number
): { text: string; mapping: TextMappingItem[] } {
  const mapping: TextMappingItem[] = []
  let text = ""
  let textPos = 0

  doc.nodesBetween(from, to, (node, pos) => {
    if (node.isText) {
      const start = Math.max(from, pos)
      const end = Math.min(to, pos + node.nodeSize)
      const content = node.text!.slice(start - pos, end - pos)

      mapping.push({ from: textPos, docPos: start })
      text += content
      textPos += content.length
    } else if (node.isBlock && text.length > 0) {
      // Add newline for block boundaries
      mapping.push({ from: textPos, docPos: pos })
      text += "\n"
      textPos += 1
    }
  })

  return { text, mapping }
}

// Convert text position back to document position
function textToDocPos(textPos: number, mapping: TextMappingItem[]): number {
  for (let i = mapping.length - 1; i >= 0; i--) {
    if (mapping[i].from <= textPos) {
      return mapping[i].docPos + (textPos - mapping[i].from)
    }
  }
  return mapping[0]?.docPos ?? 0
}

// Remap positions after document change
function remapPositions<C, M>(
  state: RunnerState<C, M>,
  tr: Transaction
): RunnerState<C, M> {
  // Remap unit positions
  const remappedUnits = state.unitsInProgress?.map(unit => {
    const newFrom = tr.mapping.map(unit.from)
    const newTo = tr.mapping.map(unit.to)

    // Check if text changed
    const newText = extractTextWithMapping(tr.doc, newFrom, newTo)
    const textChanged = newText.text !== unit.text

    return {
      ...unit,
      from: newFrom,
      to: newTo,
      text: newText.text,
      mapping: newText.mapping,
      status: textChanged ? UnitStatus.DIRTY : unit.status,
    }
  })

  // Remap decoration positions
  const remappedDecorations = state.decorations.map(decoration => {
    return Decoration.inline(
      tr.mapping.map(decoration.from),
      tr.mapping.map(decoration.to),
      decoration.spec.attrs,
      decoration.spec
    )
  }).filter(d => d.from < d.to)  // Remove collapsed decorations

  return {
    ...state,
    unitsInProgress: remappedUnits,
    decorations: remappedDecorations,
  }
}
```

---

## 7. Helper Utilities

### Unit Extraction

```typescript
// Get all paragraphs in range
function getUnitsInRange(
  doc: Node,
  from: number,
  to: number,
  nodeType: string = "paragraph"
): Array<{ from: number; to: number; text: string; mapping: TextMappingItem[] }> {
  const units: Array<{ from: number; to: number; text: string; mapping: TextMappingItem[] }> = []

  doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name === nodeType) {
      const extracted = extractTextWithMapping(doc, pos, pos + node.nodeSize)
      if (extracted.text.trim().length > 0) {
        units.push({
          from: pos,
          to: pos + node.nodeSize,
          ...extracted,
        })
      }
    }
  })

  return units
}
```

### Progress Tracking

```typescript
function getProgress<C, M>(state: RunnerState<C, M>): {
  completed: number
  total: number
  decorations: number
} {
  if (state.status !== RunnerStatus.ACTIVE) {
    return { completed: 0, total: 0, decorations: state.decorations.length }
  }

  const units = state.unitsInProgress ?? []
  const completed = units.filter(u =>
    u.status === UnitStatus.DONE || u.status === UnitStatus.ERROR
  ).length

  return {
    completed,
    total: units.length,
    decorations: state.decorations.length,
  }
}
```

### Keyboard Navigation

```typescript
function createNavigationHandler(
  pluginKey: PluginKey,
  direction: "next" | "prev"
): KeyHandler {
  return (view, event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return false

    const state = pluginKey.getState(view.state)
    const visibleDecorations = state.decorations.filter(d =>
      state.options.visibilityFilter(d, state.contextState)
    )

    if (visibleDecorations.length === 0) return false

    const currentIdx = state.selected
      ? visibleDecorations.findIndex(d => d.spec.id === state.selected)
      : -1

    let nextIdx: number
    if (direction === "next" || event.key === "ArrowDown") {
      nextIdx = currentIdx + 1 >= visibleDecorations.length ? 0 : currentIdx + 1
    } else {
      nextIdx = currentIdx - 1 < 0 ? visibleDecorations.length - 1 : currentIdx - 1
    }

    const nextDecoration = visibleDecorations[nextIdx]

    // Select and scroll to decoration
    view.dispatch(
      view.state.tr.setMeta(pluginKey, {
        type: ActionType.SELECT_DECORATION,
        id: nextDecoration.spec.id,
      })
    )

    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(view.state.doc, nextDecoration.from)
      ).scrollIntoView()
    )

    return true
  }
}
```

---

## 8. Complete Data Flow

```
1. USER ACTIVATES RUNNER
   └─ dispatch({ type: INIT, metadata: { ... } })

2. INIT HANDLER (state.ts)
   ├─ Extract units from document (paragraphs)
   ├─ Apply metadata to each unit
   ├─ Set status: WAITING → QUEUED (if priorityFilter passes)
   └─ Return state with status: ACTIVE

3. VIEW UPDATE (extension)
   ├─ Detect status === ACTIVE
   └─ Spawn executeParallel()

4. WORKER LOOP (executor.ts)
   ├─ selectNextUnit() → get QUEUED unit
   ├─ dispatch({ type: UNIT_STARTED })
   ├─ Wait for backoff deadline
   ├─ Call unitProcessor(view, unit)
   └─ dispatch({ type: UNIT_SUCCESS/ERROR })

5. SUCCESS HANDLER (state.ts)
   ├─ Update unit status → DONE
   ├─ Call decorationFactory(response, unit)
   └─ Add ResultDecorations to state

6. DECORATION RENDER (extension)
   ├─ Filter by visibilityFilter
   ├─ Transform with decorationTransformer
   ├─ Add loading widgets for in-progress units
   └─ Return DecorationSet

7. USER INTERACTS WITH DECORATION
   ├─ Click: dispatch({ type: SELECT_DECORATION })
   ├─ Accept: apply suggestion, dispatch({ type: REMOVE_DECORATION })
   └─ Navigate: Arrow keys cycle through decorations

8. ALL UNITS DONE
   └─ dispatch({ type: FINISH }) → status: IDLE
```

---

## 9. Key Design Patterns

1. **Generic Type Parameters**: `<ResponseType, ContextState, UnitMetadata>` for flexibility

2. **Immutable State**: All state handlers return new state objects

3. **Meta-Based Actions**: All mutations via `tr.setMeta(pluginKey, action)`

4. **Priority + Visibility Filters**: Separate concerns for processing vs. display

5. **Exponential Backoff**: Automatic retry with growing delays

6. **Position Mapping**: Track text-to-document position for accurate highlights

7. **Parallel Execution**: Configurable worker count for throughput

8. **Widget System**: Loading/error indicators per-unit

---

## Summary

This documentation provides everything needed to recreate the system. The core concepts are:

- **Processing Units** (text blocks to analyze)
- **Unit Processor** (async function that analyzes a unit)
- **Result Decorations** (visual decorations from analysis)
- **Decoration Factory** (converts responses to decorations)
- **State Machine** (IDLE/ACTIVE with unit status lifecycle)
- **Parallel Executor** (concurrent worker pool with retry logic)
