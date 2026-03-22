/**
 * attach.ts
 *
 * Core implementation of the plugin-monaco package.
 * Attaches vim keybindings to an existing Monaco Editor instance.
 */

import type { VimContext, VimAction, CursorPosition } from "@vimee/core";
import { TextBuffer, createInitialContext, processKeystroke } from "@vimee/core";
import type { AttachOptions, VimMonaco, MonacoEditor, IKeyboardEvent } from "./types";
import { cursorToMonacoPosition, monacoPositionToCursor } from "./cursor";
import { getTopLine, getVisibleLines, revealLine } from "./viewport";

/**
 * Attach vim editing to a Monaco Editor instance.
 *
 * @example
 * ```ts
 * const vim = attach(monacoEditor, {
 *   onChange: (value) => console.log(value),
 *   onModeChange: (mode) => console.log(mode),
 * });
 *
 * // Later...
 * vim.destroy();
 * ```
 */
export function attach(editor: MonacoEditor, options: AttachOptions = {}): VimMonaco {
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
  const buffer = new TextBuffer(editor.getValue());
  const pos = editor.getPosition();
  const initialCursor: CursorPosition = pos ? monacoPositionToCursor(pos) : { line: 0, col: 0 };
  let ctx: VimContext = createInitialContext(initialCursor, {
    indentStyle,
    indentWidth,
  });

  // --- Set initial cursor style (block for normal mode) ---
  updateCursorStyle(ctx.mode);

  // --- Track composing state (IME input) ---
  let isComposing = false;

  // --- Visual mode decorations ---
  const decorationCollection = editor.createDecorationsCollection();

  // --- Update Monaco cursor style based on vim mode ---
  function updateCursorStyle(mode: string): void {
    // Monaco CursorStyle: Line = 1, Block = 2, Underline = 3
    const cursorStyle = mode === "insert" ? 1 : 2;
    editor.updateOptions({ cursorStyle });
  }

  // --- Sync vimee buffer content to Monaco editor ---
  function syncContentToEditor(): void {
    const content = buffer.getContent();
    if (content !== editor.getValue()) {
      editor.setValue(content);
    }
  }

  // --- Sync cursor position to Monaco editor ---
  function syncCursorToEditor(cursor: CursorPosition): void {
    editor.setPosition(cursorToMonacoPosition(cursor));
  }

  // --- Update visual mode selection decorations ---
  function updateVisualDecorations(): void {
    if (ctx.mode !== "visual" && ctx.mode !== "visual-line" && ctx.mode !== "visual-block") {
      decorationCollection.clear();
      return;
    }

    const anchor = ctx.visualAnchor ?? ctx.cursor;
    const before =
      anchor.line < ctx.cursor.line ||
      (anchor.line === ctx.cursor.line && anchor.col <= ctx.cursor.col);
    const start = before ? anchor : ctx.cursor;
    const end = before ? ctx.cursor : anchor;

    if (ctx.mode === "visual-line") {
      decorationCollection.set([
        {
          range: {
            startLineNumber: start.line + 1,
            startColumn: 1,
            endLineNumber: end.line + 1,
            endColumn: (buffer.getLineLength(end.line) || 0) + 2,
          },
          options: { className: "vimee-visual-selection", isWholeLine: true },
        },
      ]);
    } else {
      decorationCollection.set([
        {
          range: {
            startLineNumber: start.line + 1,
            startColumn: start.col + 1,
            endLineNumber: end.line + 1,
            endColumn: end.col + 2, // +2: Monaco end is exclusive & col is 0-based
          },
          options: { className: "vimee-visual-selection" },
        },
      ]);
    }
  }

  // --- Process vim actions and sync state ---
  function processActions(actions: VimAction[], newCtx: VimContext, key: string): void {
    for (const action of actions) {
      onAction?.(action, key);

      switch (action.type) {
        case "content-change":
          syncContentToEditor();
          onChange?.(action.content);
          break;

        case "mode-change":
          updateCursorStyle(action.mode);
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

    // Always sync cursor and decorations from context
    syncCursorToEditor(newCtx.cursor);
    revealLine(editor, newCtx.cursor.line);
    updateVisualDecorations();
  }

  // --- Update viewport info on the VimContext ---
  function syncViewport(): void {
    const topLine = getTopLine(editor);
    const height = getVisibleLines(editor);
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
    const visibleLines = getVisibleLines(editor);
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
    revealLine(editor, newLine);
  }

  // --- Keyboard handler ---
  function onKeyDown(e: IKeyboardEvent): void {
    if (isComposing) return;

    const browserEvent = e.browserEvent;

    // Update viewport before processing (for H/M/L motions)
    syncViewport();

    // Handle Ctrl scroll keys at this level
    if (browserEvent.ctrlKey) {
      const scrollKeys: Record<string, { direction: "up" | "down"; amount: number }> = {
        b: { direction: "up", amount: 1.0 },
        f: { direction: "down", amount: 1.0 },
        u: { direction: "up", amount: 0.5 },
        d: { direction: "down", amount: 0.5 },
      };
      const scroll = scrollKeys[browserEvent.key];
      if (scroll) {
        e.preventDefault();
        e.stopPropagation();
        handleScroll(scroll.direction, scroll.amount);
        return;
      }
    }

    if (shouldPreventDefault(browserEvent)) {
      e.preventDefault();
      e.stopPropagation();
    }

    const { newCtx, actions } = processKeystroke(
      browserEvent.key,
      ctx,
      buffer,
      browserEvent.ctrlKey,
      readOnly,
    );

    ctx = newCtx;
    processActions(actions, newCtx, browserEvent.key);
  }

  // --- Attach event listeners ---
  const disposables = [
    editor.onKeyDown(onKeyDown),
    editor.onDidCompositionStart(() => {
      isComposing = true;
    }),
    editor.onDidCompositionEnd(() => {
      isComposing = false;
    }),
  ];

  // Initial viewport sync
  syncViewport();

  // --- Return the VimMonaco handle ---
  return {
    getMode: () => ctx.mode,
    getCursor: () => ({ ...ctx.cursor }),
    getContent: () => buffer.getContent(),
    destroy: () => {
      for (const d of disposables) {
        d.dispose();
      }
      decorationCollection.clear();
      // Reset cursor style to line (default)
      editor.updateOptions({ cursorStyle: 1 });
    },
  };
}
