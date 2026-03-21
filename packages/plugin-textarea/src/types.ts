/**
 * types.ts
 *
 * Public types for @vimee/plugin-textarea.
 */

import type { VimMode, VimAction, CursorPosition } from "@vimee/core";

/** Options passed to attach() */
export interface AttachOptions {
  /** Read-only mode -- vim motions work but no edits */
  readOnly?: boolean;

  /** Called whenever the textarea content changes via vim commands */
  onChange?: (value: string) => void;

  /** Called whenever the vim mode changes */
  onModeChange?: (mode: VimMode) => void;

  /** Called when text is yanked */
  onYank?: (text: string) => void;

  /** Called when :w is executed */
  onSave?: (value: string) => void;

  /** Called for every vim action (low-level) */
  onAction?: (action: VimAction, key: string) => void;

  /** Indent style: "space" or "tab" (default: "space") */
  indentStyle?: "space" | "tab";

  /** Indent width (default: 2) */
  indentWidth?: number;
}

/** The object returned by attach() -- the handle to the vim-enabled textarea */
export interface VimTextarea {
  /** Current vim mode */
  getMode(): VimMode;

  /** Current cursor position (0-based line/col) */
  getCursor(): CursorPosition;

  /** Current textarea content (from the vim buffer) */
  getContent(): string;

  /** Detach all event listeners and restore the textarea to its original state */
  destroy(): void;
}
