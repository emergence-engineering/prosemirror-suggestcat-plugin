# prosemirror-suggestcat-plugin

[![made by Emergence Engineering](https://emergence-engineering.com/ee-logo.svg)](https://emergence-engineering.com)

[**Made by Emergence-Engineering**](https://emergence-engineering.com/)

## Features

![feature-gif](https://suggestcat.com/suggestcat.gif)

- AI-powered grammar and style corrections for ProseMirror
- AI text completion, rewriting, translation, tone changes and more — with streaming
- Inline autocomplete with ghost text (like GitHub Copilot)
- Paragraph-level processing with dirty state tracking and parallel execution
- Multiple AI model support with automatic fallback

## Getting started

1. Create an account on [SuggestCat](https://www.suggestcat.com/) and generate an API key
2. Install the package

```sh
npm i prosemirror-suggestcat-plugin
```

3. Add the plugins you need to your ProseMirror (or TipTap) editor using your API key
4. Import the styles or write your own CSS
5. Track your usage and manage API keys on your [admin dashboard](https://www.suggestcat.com/)

## Grammar suggestion plugin

Checks your text for grammar and style issues paragraph by paragraph. Only edited paragraphs are re-checked, and multiple paragraphs are processed in parallel.

```typescript
import {
  grammarSuggestPluginV2,
  grammarSuggestV2Key,
  ActionType,
} from "prosemirror-suggestcat-plugin";

const view = new EditorView(document.querySelector("#editor"), {
  state: EditorState.create({
    doc: schema.nodeFromJSON(initialDoc),
    plugins: [
      ...exampleSetup({ schema }),
      grammarSuggestPluginV2("<YOUR_API_KEY>", {
        debounceMs: 1000,
        batchSize: 4,
      }),
    ],
  }),
});

// Initialize the grammar checker
view.dispatch(
  view.state.tr.setMeta(grammarSuggestV2Key, {
    type: ActionType.INIT,
    metadata: {},
  }),
);
```

### Options

```typescript
interface GrammarSuggestV2Options {
  apiKey: string;
  apiEndpoint?: string;
  model?: string | AIModel;
  fallback?: {
    fallbackModel: string | AIModel;
    failureThreshold?: number;  // default: 3
  };
  batchSize?: number;           // parallel workers, default: 4
  maxRetries?: number;          // default: 3
  backoffBase?: number;         // default: 2000ms
  debounceMs?: number;          // default: 1000ms
  createPopup?: (
    view: EditorView,
    decoration: Decoration,
    pos: number,
    applySuggestion: () => void,
    discardSuggestion: () => void,
    requestHint: () => Promise<string>,
  ) => HTMLElement;
}
```

### Styles

```typescript
import "prosemirror-suggestcat-plugin/dist/styles/styles.css";
```

Or style the decorations yourself using these CSS classes:

- `.grammarSuggestionV2` — inline decoration on suggestions
- `.removalSuggestionV2` — when the suggestion is a deletion
- `.grammarSuggestionV2-selected` — currently selected suggestion
- `.grammarPopupV2` — popup container

## Complete plugin

AI text completion and transformation with streaming support. Use it to complete, shorten, lengthen, simplify, explain, translate text and more.

```typescript
import { completePluginV2 } from "prosemirror-suggestcat-plugin";

const view = new EditorView(document.querySelector("#editor"), {
  state: EditorState.create({
    doc: schema.nodeFromJSON(initialDoc),
    plugins: [
      ...exampleSetup({ schema }),
      completePluginV2("<YOUR_API_KEY>", {
        maxSelection: 1000,
      }),
    ],
  }),
});
```

### Triggering tasks

Use action functions instead of dispatching metas directly:

```typescript
import {
  startTask,
  acceptResult,
  rejectResult,
  cancelTask,
  getCompleteState,
  AiPromptsWithoutParam,
  AiPromptsWithParam,
  MoodParamType,
  TranslationTargetLanguage,
} from "prosemirror-suggestcat-plugin";

// Continue writing from cursor
startTask(view, AiPromptsWithoutParam.Complete);

// Transform selected text
startTask(view, AiPromptsWithoutParam.MakeShorter);
startTask(view, AiPromptsWithoutParam.MakeLonger);
startTask(view, AiPromptsWithoutParam.Simplify);
startTask(view, AiPromptsWithoutParam.Explain);
startTask(view, AiPromptsWithoutParam.ActionItems);
startTask(view, AiPromptsWithoutParam.Improve);

// Tasks with parameters
startTask(view, AiPromptsWithParam.ChangeTone, {
  mood: MoodParamType.Friendly,
});
startTask(view, AiPromptsWithParam.Translate, {
  targetLanguage: TranslationTargetLanguage.Spanish,
});

// Accept or reject the result once streaming finishes
acceptResult(view);
rejectResult(view);

// Cancel an in-progress task
cancelTask(view);
```

### State flow

```
IDLE -> PENDING -> STREAMING -> PREVIEW -> APPLYING -> IDLE
```

During `STREAMING` the result is built up incrementally. At `PREVIEW` you can accept or reject. Only one task runs at a time.

## Autocomplete plugin

Inline ghost-text completions that appear after the cursor as you type. Press **Tab** to accept, **Escape** to dismiss.

```typescript
import { autoCompletePlugin } from "prosemirror-suggestcat-plugin";

const view = new EditorView(document.querySelector("#editor"), {
  state: EditorState.create({
    doc: schema.nodeFromJSON(initialDoc),
    plugins: [
      ...exampleSetup({ schema }),
      autoCompletePlugin("<YOUR_API_KEY>", {
        debounceMs: 500,
        maxContextLength: 2000,
      }),
    ],
  }),
});
```

### Options

```typescript
interface AutoCompleteOptions {
  debounceMs: number;          // default: 500
  maxContextLength: number;    // default: 2000
  apiEndpoint?: string;
  model?: string;
  ghostTextClass?: string;     // default: "autoCompleteGhostText"
}
```

### Styles

Add CSS for the ghost text:

```css
.autoCompleteGhostText {
  color: #9ca3af;
  opacity: 0.7;
  pointer-events: none;
}
```

### Programmatic control

```typescript
import {
  setAutoCompleteEnabled,
  acceptAutoCompletion,
  dismissAutoCompletion,
  isAutoCompleteEnabled,
  hasAutoCompletion,
} from "prosemirror-suggestcat-plugin";

setAutoCompleteEnabled(view, true);
setAutoCompleteEnabled(view, false);

if (hasAutoCompletion(view)) {
  acceptAutoCompletion(view);
  // or
  dismissAutoCompletion(view);
}
```

## How it works

### API

All plugins communicate with the SuggestCat backend through a shared API module. You can configure the endpoint and model per plugin, or use the defaults (`openai:gpt-4o-mini`).

The module exposes two request functions if you need to use them directly:

- `grammarRequest(options)` — a non-streaming POST that returns the corrected text and a list of modifications
- `streamingRequest(options, callbacks)` — a streaming request with `onChunk`, `onComplete` and `onError` callbacks, used by the complete and autocomplete plugins. Supports cancellation via `AbortSignal`.

Both accept an `ApiConfig` (`apiKey`, optional `endpoint`, optional `model`). You can use `createApiConfig` or `createGrammarApiConfig` to fill in defaults.

```typescript
import {
  streamingRequest,
  grammarRequest,
  createApiConfig,
  createGrammarApiConfig,
} from "prosemirror-suggestcat-plugin";
```

### Block runner

The grammar suggestion plugin is built on top of a generic **block runner** framework. Instead of sending the entire document to the API, it splits the document into processing units (paragraphs by default) and processes them in parallel.

Key properties:

- **Paragraph-level processing** — each paragraph is an independent unit, so large documents don't result in oversized API calls
- **Dirty state tracking** — when a paragraph is edited, only that unit is marked dirty and re-processed after a debounce delay. The plugin skips dirty marking for its own document changes (e.g. applying a suggestion)
- **Parallel execution** — multiple units are processed concurrently, controlled by `batchSize`. A unit goes through `QUEUED → PROCESSING → DONE` (or `BACKOFF → retry` on failure)
- **Retry with backoff** — failed units are retried up to `maxRetries` times with exponential backoff

The block runner is also exported as a standalone building block. You can use it to build your own paragraph-level processing plugins. The package includes a few example plugins (link detector, word complexity, sentence length) that demonstrate how to wire up a custom processor.

```typescript
import {
  blockRunnerPlugin,
  createBlockRunnerKey,
  ActionType,
  dispatchAction,
} from "prosemirror-suggestcat-plugin";
```

To create a block runner plugin, provide a `pluginKey`, a `unitProcessor` (async function that receives a processing unit and returns a result), a `decorationFactory` (turns results into ProseMirror decorations), and optionally a `widgetFactory` (shows per-unit status indicators) and a `decorationTransformer` (filters/modifies decorations based on context state).

#### Helper functions

The block runner exports utility functions you can use in your processor or elsewhere:

- `extractTextWithMapping(doc, from, to)` — extracts text from a document range and builds a position mapping between text offsets and doc positions
- `textToDocPos(textPos, mapping)` — converts a text-space position back to a document position using the mapping
- `getUnitsInRange(doc, from, to, nodeTypes?)` — finds all matching nodes in a range
- `createUnitsFromDocument(doc, from, to, metadataFactory, nodeTypes?)` — creates processing units from document nodes
- `getProgress(state)` — returns `{ completed, total, decorations }` for progress tracking
- `calculateBackoff(retryCount, baseMs)` — computes the backoff delay for retries
- `allUnitsFinished(units)` — checks if all units are in a terminal state (DONE or ERROR)

#### Manual transactions

You can control the block runner by dispatching actions via `dispatchAction(view, pluginKey, action)`:

```typescript
import { dispatchAction, ActionType } from "prosemirror-suggestcat-plugin";

// Initialize — creates units from the document and starts processing
dispatchAction(view, myPluginKey, {
  type: ActionType.INIT,
  metadata: {},
});

// Pause processing
dispatchAction(view, myPluginKey, { type: ActionType.FINISH });

// Resume paused processing
dispatchAction(view, myPluginKey, { type: ActionType.RESUME });

// Clear all state
dispatchAction(view, myPluginKey, { type: ActionType.CLEAR });

// Remove a specific decoration
dispatchAction(view, myPluginKey, {
  type: ActionType.REMOVE_DECORATION,
  id: decorationId,
});

// Update context state (e.g. for filtering or selection)
dispatchAction(view, myPluginKey, {
  type: ActionType.UPDATE_CONTEXT,
  contextState: { selectedSuggestionId: someId },
});
```

There are also convenience wrappers: `pauseRunner(view, pluginKey)`, `resumeRunner(view, pluginKey)`, and `canResume(state)`.

## Available models

All plugins accept a `model` option:

```typescript
type AIModel =
  | "openai:gpt-4o"
  | "openai:gpt-4o-mini"       // default
  | "cerebras:llama-3.1-8b"
  | "cerebras:llama-3.3-70b"
  | "cerebras:qwen-3-32b";
```

## TipTap

All plugins work with TipTap by wrapping them in an extension:

```typescript
import { Extension } from "@tiptap/core";
import {
  grammarSuggestPluginV2,
  grammarSuggestV2Key,
  ActionType,
  completePluginV2,
  autoCompletePlugin,
} from "prosemirror-suggestcat-plugin";

const SuggestCatExtension = Extension.create({
  name: "suggestcat",
  addProseMirrorPlugins() {
    return [
      grammarSuggestPluginV2("<YOUR_API_KEY>"),
      completePluginV2("<YOUR_API_KEY>"),
      autoCompletePlugin("<YOUR_API_KEY>"),
    ];
  },
});
```

## React UI

For a ready-made React UI with a slash menu, suggestion overlay and "Ask AI" tooltip, see [prosemirror-suggestcat-plugin-react](https://github.com/emergence-engineering/prosemirror-suggestcat-plugin-react).