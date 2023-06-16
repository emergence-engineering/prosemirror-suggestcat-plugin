# prosemirror-suggestcat-plugin

![made by Emergence Engineering](https://emergence-engineering.com/ee-logo.svg)

[**Made by Emergence-Engineering**](https://emergence-engineering.com/)

## Features

- Adds AI features to your ProseMirror editor
- Coming soon: text completion, rewriting with a given style, YJS support and more!

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
            ...exampleSetup({schema}),
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
