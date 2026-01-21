import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: resolve(__dirname, "fixtures/test-harness"),
  server: {
    port: 3333,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@blockRunner": resolve(__dirname, "../../src/blockRunner"),
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
