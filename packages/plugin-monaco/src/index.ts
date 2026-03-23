/**
 * @vimee/plugin-monaco
 *
 * Attach vim editing to any Monaco Editor instance.
 * Framework-agnostic — works with vanilla JS, React, or any Monaco wrapper.
 *
 * @example
 * ```ts
 * import { attach } from '@vimee/plugin-monaco'
 *
 * const vim = attach(monacoEditor, {
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
export type { AttachOptions, VimMonaco, MonacoEditor } from "./types";
export type {
  IDisposable,
  IPosition,
  IRange,
  IKeyboardEvent,
  ITextModel,
  IModelDeltaDecoration,
  IModelDecorationOptions,
  IEditorDecorationsCollection,
} from "./types";

// Cursor utilities (for advanced usage)
export { cursorToMonacoPosition, monacoPositionToCursor } from "./cursor";

// Viewport utilities (for advanced usage)
export { getTopLine, getVisibleLines, revealLine } from "./viewport";

// Re-export commonly used core types for convenience
export type { VimMode, VimAction, CursorPosition } from "@vimee/core";
