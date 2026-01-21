import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: resolve(__dirname, "fixtures/test-harness"),
  server: {
    port: 3335,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@grammarSuggestV2": resolve(__dirname, "../../src/grammarSuggestV2"),
      "@blockRunner": resolve(__dirname, "../../src/blockRunner"),
      "@src": resolve(__dirname, "../../src"),
    },
  },
  optimizeDeps: {
    include: [
      "prosemirror-state",
      "prosemirror-view",
      "prosemirror-model",
      "prosemirror-schema-basic",
      "prosemirror-example-setup",
      "prosemirror-transform",
    ],
  },
});
