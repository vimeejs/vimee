/**
 * @vimee/plugin-codemirror
 *
 * Attach vim editing to any CodeMirror 6 EditorView.
 * Framework-agnostic — works with vanilla JS, React, or any CodeMirror wrapper.
 *
 * @example
 * ```ts
 * import { attach } from '@vimee/plugin-codemirror'
 *
 * const vim = attach(editorView, {
 *   onChange: (value) => console.log(value),
 *   onModeChange: (mode) => console.log(mode),
 * })
 *
 * vim.destroy()
 * ```
 */

// Main function
export { attach } from "./attach";

// Types
export type { AttachOptions, VimCodeMirror, CodeMirrorView } from "./types";
export type {
  CodeMirrorLine,
  CodeMirrorDoc,
  CodeMirrorState,
  CodeMirrorTransactionSpec,
} from "./types";

// Cursor utilities (for advanced usage)
export { cursorToOffset, offsetToCursor } from "./cursor";

// Viewport utilities (for advanced usage)
export { getTopLine, getVisibleLines } from "./viewport";

// Re-export commonly used core types for convenience
export type { VimMode, VimAction, CursorPosition } from "@vimee/core";
