# prosemirror-suggestcat-plugin

![made by Emergence Engineering](https://emergence-engineering.com/ee-logo.svg)

[**Made by Emergence-Engineering**](https://emergence-engineering.com/)

## Features

- easy to use
- we provide you styles, but you can also override them
- fully customizable popup

## How to use?

- create your API_KEY on [SuggestCar website](https://www.suggestcat.com/)
- add `grammarSuggestPlugin`
- add your api key
- and `defaultOptions` which you can override

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

- add our css for the popup, or you can create your own using `createUpdatePopup` option

```typescript
import "prosemirror-suggestcat-plugin/dist/styles/styles.css";
```

- our popup structure:

```html
<div classname="grammar-suggest-tooltip ProseMirror-widget">
  <div classname="grammar-suggest-tooltip-apply">suggestion</div
  <div classname="grammar-suggest-tooltip-discard"><svg /></div
</div
```
