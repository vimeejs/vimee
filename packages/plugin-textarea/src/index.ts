/**
 * @vimee/plugin-textarea
 *
 * Attach vim editing to any HTML textarea element.
 * Framework-agnostic — works with vanilla JS, shadcn/ui, or any textarea.
 *
 * @example
 * ```ts
 * import { attach } from '@vimee/plugin-textarea'
 *
 * const vim = attach(document.querySelector('textarea')!, {
 *   onChange: (value) => console.log(value),
 *   onModeChange: (mode) => console.log(mode),
 * })
 *
 * // CSS: textarea[data-vimee-mode="normal"] { ... }
 *
 * vim.destroy()
 * ```
 */

// Main function
export { attach } from "./attach";

// Types
export type { AttachOptions, VimTextarea } from "./types";

// Cursor utilities (for advanced usage)
export { cursorToOffset, offsetToCursor, applyCursorToTextarea } from "./cursor";

// Viewport utilities (for advanced usage)
export {
  getLineHeight,
  getVisibleLines,
  getTopLine,
  scrollToLine,
} from "./viewport";

// Re-export commonly used core types for convenience
export type { VimMode, VimAction, CursorPosition } from "@vimee/core";
