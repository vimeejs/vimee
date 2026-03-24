/**
 * types.ts
 *
 * Public types for @vimee/plugin-codemirror.
 */

import type { VimMode, VimAction, CursorPosition } from "@vimee/core";

// ---------------------------------------------------------------------------
// Minimal CodeMirror 6 interfaces
//
// Defined locally so consumers don't need to import from @codemirror/*
// directly — only as peer dependencies that provide the actual editor.
// ---------------------------------------------------------------------------

/** A single line in a CodeMirror document. */
export interface CodeMirrorLine {
  /** 1-based line number. */
  readonly number: number;
  /** Start offset of this line in the document. */
  readonly from: number;
  /** End offset of this line (exclusive of newline). */
  readonly to: number;
  /** Text content of this line. */
  readonly text: string;
}

/** Minimal subset of CodeMirror's `Text` (document). */
export interface CodeMirrorDoc {
  toString(): string;
  /** Total character length of the document. */
  readonly length: number;
  /** Total number of lines. */
  readonly lines: number;
  /** Get the line that contains the given character offset. */
  lineAt(pos: number): CodeMirrorLine;
  /** Get a line by its 1-based line number. */
  line(n: number): CodeMirrorLine;
}

/** Minimal subset of CodeMirror's `EditorState`. */
export interface CodeMirrorState {
  readonly doc: CodeMirrorDoc;
}

/** Transaction spec for `EditorView.dispatch()`. */
export interface CodeMirrorTransactionSpec {
  changes?: { from: number; to?: number; insert?: string };
  selection?: { anchor: number; head?: number } | { ranges: unknown; mainIndex?: number };
  scrollIntoView?: boolean;
}

/**
 * Minimal subset of CodeMirror's `EditorView`.
 *
 * Any object satisfying this interface can be passed to `attach()`.
 */
export interface CodeMirrorView {
  /** The outer DOM element of the editor. */
  readonly dom: HTMLElement;
  /** The content-editable DOM element where text is edited. */
  readonly contentDOM: HTMLElement;
  /** The current editor state. */
  readonly state: CodeMirrorState;
  /** The currently visible viewport range (character offsets). */
  readonly viewport: { from: number; to: number };
  /** Dispatch one or more transaction specs to the editor. */
  dispatch(...specs: CodeMirrorTransactionSpec[]): void;
  /** Focus the editor. */
  focus(): void;
}

// ---------------------------------------------------------------------------
// Plugin public API
// ---------------------------------------------------------------------------

/** Options passed to `attach()`. */
export interface AttachOptions {
  /** Read-only mode — vim motions work but no edits. */
  readOnly?: boolean;

  /** Called whenever the editor content changes via vim commands. */
  onChange?: (value: string) => void;

  /** Called whenever the vim mode changes. */
  onModeChange?: (mode: VimMode) => void;

  /** Called when text is yanked. */
  onYank?: (text: string) => void;

  /** Called when `:w` is executed. */
  onSave?: (value: string) => void;

  /** Called for every vim action (low-level). */
  onAction?: (action: VimAction, key: string) => void;

  /** Indent style: "space" or "tab" (default: "space"). */
  indentStyle?: "space" | "tab";

  /** Indent width (default: 2). */
  indentWidth?: number;
}

/** The object returned by `attach()` — the handle to the vim-enabled editor. */
export interface VimCodeMirror {
  /** Current vim mode. */
  getMode(): VimMode;

  /** Current cursor position (0-based line/col). */
  getCursor(): CursorPosition;

  /** Current editor content (from the vim buffer). */
  getContent(): string;

  /** Detach all event listeners and restore the editor to its original state. */
  destroy(): void;
}
