# prosemirror-suggestcat-plugin

![made by Emergence Engineering](https://emergence-engineering.com/ee-logo.svg)

[**Made by Emergence-Engineering**](https://emergence-engineering.com/)

## Features

![feature-gif](https://suggestcat.com/suggestcat.gif)

- Adds AI features to your ProseMirror editor
- YJS support
- Text completion, rewriting content to make it shorter or longer.

## How to use?

- Create your API_KEY on [SuggestCat](https://www.suggestcat.com/)
- Add `grammarSuggestPlugin`
- Add your api key
- And `defaultOptions` which you can override

```typescript
import {
  grammarSuggestPlugin,
  defaultOptions,
} from "prosemirror-suggestcat-plugin";

const view = new EditorView(document.querySelector("#editor"), {
  state: EditorState.create({
    doc: schema.nodeFromJSON(initialDoc),
    plugins: [
      ...exampleSetup({ schema }),
      grammarSuggestPlugin(PROSEMIRROR_SUGGESTCAT_PLUGIN_API_KEY, {
        ...defaultOptions,
      }),
    ],
  }),
});
```

### Options

- `GrammarSuggestPluginOptions`

```typescript
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
```

- `defaultOptions` which you can import from our library

```typescript
export const defaultOptions: GrammarSuggestPluginOptions = {
  debounceMs: 2000,
  createUpdatePopup,
};
```

### Styles

- Add our css for the popup, or you can create your own using `createUpdatePopup` option

```typescript
import "prosemirror-suggestcat-plugin/dist/styles/styles.css";
```

- Our popup structure:

```html

<div classname="grammar-suggest-tooltip ProseMirror-widget">
    <div classname="grammar-suggest-tooltip-apply">
        suggestion
    </div
    <div classname="grammar-suggest-tooltip-discard">
        <svg/>
    </div
</div
```

- Style the editor decorations with the follwing classnames

```css
.grammarSuggestion {
  background-color: green;
}

.grammarSuggestion .removalSuggestion {
  background-color: red;
}
```

### AI feature to complete text, or make it longer/shorter

- you can use another plugin from this package called `completePlugin`
- with prosemirror meta calls you can transform your existing content, or generate more content based on your existing content

#### Usage

- import the `completePlugin` and provide your API key, and optional options

```ts
import {
  completePluginKey,
  completePlugin,
  defaultCompleteOptions,
  completePluginKey,
} from "prosemirror-suggestcat-plugin";

const v = new EditorView(document.querySelector("#editor"), {
  state: EditorState.create({
    doc: schema.nodeFromJSON(initialDoc),
    plugins: [
      ...exampleSetup({ schema }),
      completePlugin(<YOUR_API_KEY>, defaultCompleteOptions),
    ],
  }),
});
```

- `DefaultCompleteOptions`:
- `maxSelection` defaults to 1000 - can controll how long text will be sent to AI to transform it

```ts
export interface DefaultCompleteOptions {
  maxSelection: number;
}
```

#### How it works?

- the plugin's initial state is `{status: "idle"}`
- send the plugin a task using `setMeta` using the `completePluginKey` plugin key

```ts
view.dispatch(
  view.state.tr.setMeta(completePluginKey, {
    type: "Complete",
    status: "new",
  }),
);
```

- pluginState will change to `{type: "Complete", status: "streaming", result: "some string being streamed...", }`

- when the AI finishes the pluginState's status changes to `{status: "finished"}`
- at this point you can either accept or reject the completion

```ts
view.dispatch(
  view.state.tr.setMeta(completePluginKey, {
    type: "Complete",
    status: "accpeted",
  }),
);
```

- after accepting it, your completion will be placed at the end of your document and the pluginState changes to `{status: "idle"}`waiting for a new task
- only one task can be ran at once
- only pluginState with `{status: "idle"}` can handle a new task
- if pluginState has an error like `{status: "error", error: "selection is too big"}` you can clear the error dispatching an `accepted` meta like above
- the plugin takes care of replacing existing text, or appending the completion result to the end of your document
- `MakeLonger/MakeShorter` - requires a selection, which content to make shorter or longer

```ts
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
```

- Example for completion

```ts
const getStuff = useCallback(() => {
  if (!view) {
    return;
  }

  view.dispatch(
    view.state.tr.setMeta(completePluginKey, {
      type: "Complete",
      status: "new",
    }),
  );
}, [view]);

const completeStuff = useCallback(() => {
  if (!view) {
    return;
  }
  const state = completePluginKey.getState(view.state);

  if (state?.status === "finished")
    view.dispatch(
      view.state.tr.setMeta(completePluginKey, {
        type: "Complete",
        status: "accepted",
      }),
    );
}, [view]);
```
