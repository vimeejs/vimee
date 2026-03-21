/**
 * attach.ts
 *
 * Core implementation of the plugin-textarea package.
 * Attaches vim keybindings to an existing textarea element.
 */

import type { VimContext, VimAction, CursorPosition } from "@vimee/core";
import { TextBuffer, createInitialContext, processKeystroke } from "@vimee/core";
import type { AttachOptions, VimTextarea } from "./types";
import { applyCursorToTextarea, offsetToCursor } from "./cursor";
import {
  getVisibleLines,
  getTopLine,
  scrollToLine,
} from "./viewport";

/**
 * Attach vim editing to a textarea element.
 *
 * @example
 * ```ts
 * const vim = attach(document.querySelector("textarea")!, {
 *   onChange: (value) => console.log(value),
 * });
 *
 * // Later...
 * vim.destroy();
 * ```
 */
export function attach(
  textarea: HTMLTextAreaElement,
  options: AttachOptions = {},
): VimTextarea {
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
  const buffer = new TextBuffer(textarea.value);
  const initialCursor = offsetToCursor(
    textarea.value,
    textarea.selectionStart ?? 0,
  );
  let ctx: VimContext = createInitialContext(initialCursor, {
    indentStyle,
    indentWidth,
  });

  // --- Set initial mode attribute ---
  textarea.dataset.vimeeMode = ctx.mode;

  // --- Track composing state (IME input) ---
  let isComposing = false;

  // --- Process vim actions and sync state ---
  function processActions(actions: VimAction[], newCtx: VimContext, key: string): void {
    for (const action of actions) {
      onAction?.(action, key);

      switch (action.type) {
        case "content-change":
          textarea.value = action.content;
          onChange?.(action.content);
          break;

        case "mode-change":
          textarea.dataset.vimeeMode = action.mode;
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

    // Always sync cursor and mode from context
    textarea.dataset.vimeeMode = newCtx.mode;
    applyCursorToTextarea(textarea, newCtx.cursor);
    scrollToLine(textarea, newCtx.cursor.line);
  }

  // --- Update viewport info on the VimContext ---
  function syncViewport(): void {
    const topLine = getTopLine(textarea);
    const height = getVisibleLines(textarea);
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
    const visibleLines = getVisibleLines(textarea);
    const scrollLines = Math.max(1, Math.floor(visibleLines * amount));
    const newLine =
      direction === "up"
        ? Math.max(0, ctx.cursor.line - scrollLines)
        : Math.min(buffer.getLineCount() - 1, ctx.cursor.line + scrollLines);

    const maxCol = Math.max(0, buffer.getLineLength(newLine) - 1);
    const newCursor: CursorPosition = {
      line: newLine,
      col: Math.min(ctx.cursor.col, maxCol),
    };

    ctx = { ...ctx, cursor: newCursor };
    applyCursorToTextarea(textarea, newCursor);
    scrollToLine(textarea, newLine);
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

    const { newCtx, actions } = processKeystroke(
      e.key,
      ctx,
      buffer,
      e.ctrlKey,
      readOnly,
    );

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

  // --- Scroll event handler (update viewport info) ---
  function onScrollEvent(): void {
    syncViewport();
  }

  // --- Attach event listeners ---
  textarea.addEventListener("keydown", onKeyDown);
  textarea.addEventListener("compositionstart", onCompositionStart);
  textarea.addEventListener("compositionend", onCompositionEnd);
  textarea.addEventListener("scroll", onScrollEvent);

  // Initial viewport sync
  syncViewport();

  // --- Return the VimTextarea handle ---
  return {
    getMode: () => ctx.mode,
    getCursor: () => ({ ...ctx.cursor }),
    getContent: () => buffer.getContent(),
    destroy: () => {
      textarea.removeEventListener("keydown", onKeyDown);
      textarea.removeEventListener("compositionstart", onCompositionStart);
      textarea.removeEventListener("compositionend", onCompositionEnd);
      textarea.removeEventListener("scroll", onScrollEvent);
      delete textarea.dataset.vimeeMode;
    },
  };
}
