import {
  TextBuffer,
  processKeystroke,
  createInitialContext,
} from "@vimee/core";
import type {
  VimContext,
  VimAction,
  VimMode,
  CursorPosition,
} from "@vimee/core";
import { parseKeys } from "./key-parser";
import type { KeyInput } from "./key-parser";

export interface VimOptions {
  /** Cursor position as [line, col]. Defaults to [0, 0]. */
  cursor?: [number, number];
  /** Initial mode. Defaults to "normal". */
  mode?: VimMode;
  /** Visual anchor as [line, col]. Required for visual modes. */
  anchor?: [number, number];
  /** Indent style. Defaults to "space". */
  indentStyle?: "space" | "tab";
  /** Indent width. Defaults to 2. */
  indentWidth?: number;
}

export class VimHarness {
  private _ctx: VimContext;
  private _buffer: TextBuffer;
  private _lastActions: VimAction[] = [];
  private _allActions: VimAction[] = [];

  constructor(text: string, opts: VimOptions = {}) {
    this._buffer = new TextBuffer(text);

    const cursorPos: CursorPosition = opts.cursor
      ? { line: opts.cursor[0], col: opts.cursor[1] }
      : { line: 0, col: 0 };

    this._ctx = createInitialContext(cursorPos, {
      indentStyle: opts.indentStyle,
      indentWidth: opts.indentWidth,
    });

    // Apply mode overrides
    if (opts.mode) {
      this._ctx = { ...this._ctx, mode: opts.mode };

      // Set status message for non-normal modes
      const statusMap: Partial<Record<VimMode, string>> = {
        insert: "-- INSERT --",
        visual: "-- VISUAL --",
        "visual-line": "-- VISUAL LINE --",
        "visual-block": "-- VISUAL BLOCK --",
      };
      if (statusMap[opts.mode]) {
        this._ctx = { ...this._ctx, statusMessage: statusMap[opts.mode]! };
      }
    }

    // Set visual anchor if provided
    if (opts.anchor) {
      this._ctx = {
        ...this._ctx,
        visualAnchor: { line: opts.anchor[0], col: opts.anchor[1] },
      };
    }
  }

  /**
   * Send a key sequence to the Vim engine.
   *
   * @param keys - Vim-style key notation (e.g., "dd", "<C-d>", "ciw")
   * @param insertText - Text to type after keys, followed by automatic <Esc>
   * @returns this (for chaining)
   */
  type(keys: string, insertText?: string): this {
    this._lastActions = [];

    const parsed = parseKeys(keys);
    this._processKeyInputs(parsed);

    if (insertText !== undefined) {
      // Type each character of the insert text
      const textKeys = parseKeys(insertText);
      this._processKeyInputs(textKeys);
      // Auto-escape back to normal mode
      this._processKeyInputs(["Escape"]);
    }

    return this;
  }

  /** Get the full buffer content. */
  content(): string {
    return this._buffer.getContent();
  }

  /** Get the current cursor position. */
  cursor(): CursorPosition {
    return { ...this._ctx.cursor };
  }

  /** Get the current mode. */
  mode(): VimMode {
    return this._ctx.mode;
  }

  /** Get all lines as an array. */
  lines(): string[] {
    return [...this._buffer.getLines()];
  }

  /** Get a specific line by index (0-based). */
  line(index: number): string {
    return this._buffer.getLine(index);
  }

  /** Get the content of a register. Use '"' for the unnamed register. */
  register(name: string): string {
    if (name === '"') {
      return this._ctx.register;
    }
    return this._ctx.registers[name] ?? "";
  }

  /** Get actions emitted by the last type() call. */
  actions(): VimAction[] {
    return [...this._lastActions];
  }

  /** Get all actions emitted since creation. */
  allActions(): VimAction[] {
    return [...this._allActions];
  }

  /** Get the current status message. */
  statusMessage(): string {
    return this._ctx.statusMessage;
  }

  /** Access the raw internal state for advanced assertions. */
  raw(): { ctx: VimContext; buffer: TextBuffer } {
    return { ctx: this._ctx, buffer: this._buffer };
  }

  private _processKeyInputs(inputs: KeyInput[]): void {
    for (const input of inputs) {
      const key = typeof input === "string" ? input : input.key;
      const ctrlKey = typeof input === "string" ? false : input.ctrlKey;
      const result = processKeystroke(key, this._ctx, this._buffer, ctrlKey);
      this._ctx = result.newCtx;
      this._lastActions.push(...result.actions);
      this._allActions.push(...result.actions);
    }
  }
}
