/**
 * types.ts
 *
 * Public types for @vimee/plugin-monaco.
 */

import type { VimMode, VimAction, CursorPosition } from "@vimee/core";

// ---------------------------------------------------------------------------
// Minimal Monaco Editor interfaces
//
// Defined locally so consumers don't need the full `monaco-editor` package
// as a dependency — only as a peer that provides the actual editor instance.
// ---------------------------------------------------------------------------

/** Disposable handle returned by Monaco event subscriptions. */
export interface IDisposable {
  dispose(): void;
}

/** 1-based position in Monaco (lineNumber ≥ 1, column ≥ 1). */
export interface IPosition {
  readonly lineNumber: number;
  readonly column: number;
}

/** 1-based range in Monaco. */
export interface IRange {
  readonly startLineNumber: number;
  readonly startColumn: number;
  readonly endLineNumber: number;
  readonly endColumn: number;
}

/** Decoration options applied to a range. */
export interface IModelDecorationOptions {
  className?: string | null;
  isWholeLine?: boolean;
}

/** A single decoration descriptor. */
export interface IModelDeltaDecoration {
  range: IRange;
  options: IModelDecorationOptions;
}

/** Monaco keyboard event wrapper. */
export interface IKeyboardEvent {
  readonly browserEvent: KeyboardEvent;
  preventDefault(): void;
  stopPropagation(): void;
}

/** Minimal subset of Monaco's ITextModel. */
export interface ITextModel {
  getValue(): string;
  setValue(value: string): void;
  getLineContent(lineNumber: number): string;
  getLineCount(): number;
  getLineMaxColumn(lineNumber: number): number;
}

/** Decoration collection (Monaco ≥ 0.34). */
export interface IEditorDecorationsCollection {
  set(decorations: IModelDeltaDecoration[]): void;
  clear(): void;
}

/**
 * Minimal subset of `monaco.editor.IStandaloneCodeEditor`.
 *
 * Any object satisfying this interface can be passed to `attach()`.
 */
export interface MonacoEditor {
  getValue(): string;
  setValue(value: string): void;
  getPosition(): IPosition | null;
  setPosition(position: IPosition): void;
  getModel(): ITextModel | null;
  onKeyDown(listener: (e: IKeyboardEvent) => void): IDisposable;
  onDidCompositionStart(listener: () => void): IDisposable;
  onDidCompositionEnd(listener: () => void): IDisposable;
  createDecorationsCollection(decorations?: IModelDeltaDecoration[]): IEditorDecorationsCollection;
  getVisibleRanges(): IRange[];
  revealLine(lineNumber: number): void;
  updateOptions(options: Record<string, unknown>): void;
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
export interface VimMonaco {
  /** Current vim mode. */
  getMode(): VimMode;

  /** Current cursor position (0-based line/col). */
  getCursor(): CursorPosition;

  /** Current editor content (from the vim buffer). */
  getContent(): string;

  /** Detach all event listeners and restore the editor to its original state. */
  destroy(): void;
}
