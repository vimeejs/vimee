import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["@codemirror/state", "@codemirror/view"],
  },
  build: {
    rollupOptions: {
      input: {
        textarea: resolve(__dirname, "src/textarea/index.html"),
        monaco: resolve(__dirname, "src/monaco/index.html"),
        codemirror: resolve(__dirname, "src/codemirror/index.html"),
        "shiki-editor": resolve(__dirname, "src/shiki-editor/index.html"),
      },
    },
  },
});
