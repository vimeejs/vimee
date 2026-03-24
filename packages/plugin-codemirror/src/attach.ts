/**
 * attach.ts
 *
 * Core implementation of the plugin-codemirror package.
 * Attaches vim keybindings to an existing CodeMirror 6 EditorView.
 */

import type { VimContext, VimAction, CursorPosition } from "@vimee/core";
import { TextBuffer, createInitialContext, processKeystroke } from "@vimee/core";
import type { AttachOptions, VimCodeMirror, CodeMirrorView } from "./types";
import { cursorToOffset, offsetToCursor } from "./cursor";
import { getTopLine, getVisibleLines } from "./viewport";

/**
 * Attach vim editing to a CodeMirror 6 EditorView.
 *
 * @example
 * ```ts
 * const vim = attach(editorView, {
 *   onChange: (value) => console.log(value),
 *   onModeChange: (mode) => console.log(mode),
 * });
 *
 * // Later...
 * vim.destroy();
 * ```
 */
export function attach(view: CodeMirrorView, options: AttachOptions = {}): VimCodeMirror {
  const {
    readOnly = false,
    onChange,
    onModeChange,
    onYank,
    onSave,
    onAction,
    indentStyle,
    indentWidth,
  } = options;

  // --- Initialize vim engine ---
  const content = view.state.doc.toString();
  const buffer = new TextBuffer(content);
  const initialCursor = offsetToCursor(content, 0);
  let ctx: VimContext = createInitialContext(initialCursor, {
    indentStyle,
    indentWidth,
  });

  // --- Track composing state (IME input) ---
  let isComposing = false;

  // --- Sync vimee buffer content to CodeMirror ---
  function syncContentToEditor(): void {
    const newContent = buffer.getContent();
    const doc = view.state.doc;
    if (newContent !== doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: doc.length, insert: newContent },
      });
    }
  }

  // --- Sync cursor position to CodeMirror ---
  function syncCursorToEditor(cursor: CursorPosition): void {
    const offset = cursorToOffset(buffer.getContent(), cursor);
    view.dispatch({
      selection: { anchor: offset },
      scrollIntoView: true,
    });
  }

  // --- Update visual mode selection ---
  function updateVisualSelection(): void {
    if (ctx.mode !== "visual" && ctx.mode !== "visual-line" && ctx.mode !== "visual-block") {
      // In non-visual modes, just set cursor position
      const offset = cursorToOffset(buffer.getContent(), ctx.cursor);
      view.dispatch({
        selection: { anchor: offset },
        scrollIntoView: true,
      });
      return;
    }

    const anchor = ctx.visualAnchor ?? ctx.cursor;
    const content = buffer.getContent();

    if (ctx.mode === "visual-line") {
      // Extend selection to full lines
      const before =
        anchor.line < ctx.cursor.line ||
        (anchor.line === ctx.cursor.line && anchor.col <= ctx.cursor.col);
      const startLine = before ? anchor.line : ctx.cursor.line;
      const endLine = before ? ctx.cursor.line : anchor.line;

      const lines = content.split("\n");
      const startOffset = cursorToOffset(content, { line: startLine, col: 0 });
      const endOffset = cursorToOffset(content, {
        line: endLine,
        col: lines[endLine]?.length ?? 0,
      });

      view.dispatch({
        selection: { anchor: startOffset, head: endOffset },
        scrollIntoView: true,
      });
    } else {
      // Character-wise visual mode
      const anchorOffset = cursorToOffset(content, anchor);
      const cursorOffset = cursorToOffset(content, ctx.cursor);

      // Extend selection to include the character under cursor
      const before =
        anchor.line < ctx.cursor.line ||
        (anchor.line === ctx.cursor.line && anchor.col <= ctx.cursor.col);
      const head = before ? cursorOffset + 1 : cursorOffset;
      const anchorAdj = before ? anchorOffset : anchorOffset + 1;

      view.dispatch({
        selection: { anchor: anchorAdj, head },
        scrollIntoView: true,
      });
    }
  }

  // --- Process vim actions and sync state ---
  function processActions(actionList: VimAction[], newCtx: VimContext, key: string): void {
    for (const action of actionList) {
      onAction?.(action, key);

      switch (action.type) {
        case "content-change":
          syncContentToEditor();
          onChange?.(action.content);
          break;

        case "mode-change":
          onModeChange?.(action.mode);
          break;

        case "yank":
          onYank?.(action.text);
          break;

        case "save":
          onSave?.(action.content);
          break;

        case "set-option":
        case "status-message":
        case "scroll":
        case "noop":
          break;
      }
    }

    // Always sync cursor/selection from context
    updateVisualSelection();
  }

  // --- Update viewport info on the VimContext ---
  function syncViewport(): void {
    const topLine = getTopLine(view);
    const height = getVisibleLines(view);
    ctx = {
      ...ctx,
      viewportTopLine: topLine,
      viewportHeight: height,
    };
  }

  // --- Determine if default behavior should be prevented ---
  function shouldPreventDefault(e: KeyboardEvent): boolean {
    const mode = ctx.mode;

    // In normal/visual/command-line mode, prevent all printable keys
    if (mode !== "insert") {
      // Allow modifier-only keys and browser shortcuts like Ctrl-C (copy)
      if (e.ctrlKey && (e.key === "c" || e.key === "a")) return false;
      if (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") {
        return false;
      }
      return true;
    }

    // In insert mode, prevent special keys handled by vim engine
    if (e.key === "Escape") return true;
    if (e.key === "Tab") return true;
    if (e.key === "Backspace") return true;
    if (e.key === "Enter") return true;
    if (e.ctrlKey) {
      const ctrlKeys = ["r", "b", "f", "d", "u", "v", "w"];
      if (ctrlKeys.includes(e.key)) return true;
    }

    return true; // Prevent all — vim engine handles insert mode character input
  }

  // --- Scroll handler for Ctrl-U/D/B/F ---
  function handleScroll(direction: "up" | "down", amount: number): void {
    const visibleLines = getVisibleLines(view);
    const scrollLines = Math.max(1, Math.floor(visibleLines * amount));
    const newLine =
      direction === "up"
        ? Math.max(0, ctx.cursor.line - scrollLines)
        : Math.min(buffer.getLineCount() - 1, ctx.cursor.line + scrollLines);

    const maxCol = Math.max(0, (buffer.getLineLength(newLine) || 1) - 1);
    const newCursor: CursorPosition = {
      line: newLine,
      col: Math.min(ctx.cursor.col, maxCol),
    };

    ctx = { ...ctx, cursor: newCursor };
    syncCursorToEditor(newCursor);
  }

  // --- Keyboard handler ---
  function onKeyDown(e: KeyboardEvent): void {
    if (isComposing) return;

    // Update viewport before processing (for H/M/L motions)
    syncViewport();

    // Handle Ctrl scroll keys at this level
    if (e.ctrlKey) {
      const scrollKeys: Record<string, { direction: "up" | "down"; amount: number }> = {
        b: { direction: "up", amount: 1.0 },
        f: { direction: "down", amount: 1.0 },
        u: { direction: "up", amount: 0.5 },
        d: { direction: "down", amount: 0.5 },
      };
      const scroll = scrollKeys[e.key];
      if (scroll) {
        e.preventDefault();
        handleScroll(scroll.direction, scroll.amount);
        return;
      }
    }

    if (shouldPreventDefault(e)) {
      e.preventDefault();
    }

    const { newCtx, actions } = processKeystroke(e.key, ctx, buffer, e.ctrlKey, readOnly);

    ctx = newCtx;
    processActions(actions, newCtx, e.key);
  }

  // --- IME composition handlers ---
  function onCompositionStart(): void {
    isComposing = true;
  }

  function onCompositionEnd(): void {
    isComposing = false;
  }

  // --- Attach event listeners ---
  const target = view.contentDOM;
  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("compositionstart", onCompositionStart);
  target.addEventListener("compositionend", onCompositionEnd);

  // Initial viewport sync
  syncViewport();

  // --- Return the VimCodeMirror handle ---
  return {
    getMode: () => ctx.mode,
    getCursor: () => ({ ...ctx.cursor }),
    getContent: () => buffer.getContent(),
    destroy: () => {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("compositionstart", onCompositionStart);
      target.removeEventListener("compositionend", onCompositionEnd);
    },
  };
}
