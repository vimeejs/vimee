/**
 * attach.ts
 *
 * Core implementation of the plugin-codemirror package.
 * Attaches vim keybindings to an existing CodeMirror 6 EditorView.
 */

import type { VimContext, VimAction, CursorPosition } from "@vimee/core";
import { TextBuffer, createInitialContext, processKeystroke } from "@vimee/core";
import { EditorSelection, StateEffect, StateField, RangeSetBuilder } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";
import type { AttachOptions, VimCodeMirror, CodeMirrorView } from "./types";
import { cursorToOffset, offsetToCursor } from "./cursor";
import { getTopLine, getVisibleLines } from "./viewport";

// ---------------------------------------------------------------------------
// Search highlight decorations
// ---------------------------------------------------------------------------

const setSearchPattern = StateEffect.define<string>();

const searchMark = Decoration.mark({ class: "vimee-search-match" });

function buildSearchDecorations(content: string, pattern: string): DecorationSet {
  if (!pattern) return Decoration.none;
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, "gi");
  } catch {
    return Decoration.none;
  }
  const builder = new RangeSetBuilder<Decoration>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    if (match[0].length === 0) {
      regex.lastIndex++;
      continue;
    }
    builder.add(match.index, match.index + match[0].length, searchMark);
  }
  return builder.finish();
}

const searchHighlightField = StateField.define<{ pattern: string; decorations: DecorationSet }>({
  create() {
    return { pattern: "", decorations: Decoration.none };
  },
  update(state, tr) {
    let newPattern = state.pattern;
    for (const e of tr.effects) {
      if (e.is(setSearchPattern)) {
        newPattern = e.value;
      }
    }
    if (newPattern !== state.pattern || (tr.docChanged && newPattern)) {
      return {
        pattern: newPattern,
        decorations: buildSearchDecorations(tr.state.doc.toString(), newPattern),
      };
    }
    return state;
  },
  provide(field) {
    return EditorView.decorations.from(field, (s) => s.decorations);
  },
});

const searchHighlightTheme = EditorView.baseTheme({
  ".vimee-search-match": {
    backgroundColor: "rgba(255, 210, 0, 0.3)",
  },
});

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

  // --- Track search pattern for highlight sync ---
  let prevSearchHighlight = "";

  // --- Inject search highlight extension ---
  // Use the real CM dispatch to pass effects (bypasses our minimal type)
  const cmDispatch = view.dispatch.bind(view) as (...specs: unknown[]) => void;
  cmDispatch({
    effects: StateEffect.appendConfig.of([searchHighlightField, searchHighlightTheme]),
  });

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
    } else if (ctx.mode === "visual-block") {
      // Block-wise visual mode: create a selection range per line
      const startLine = Math.min(anchor.line, ctx.cursor.line);
      const endLine = Math.max(anchor.line, ctx.cursor.line);
      const startCol = Math.min(anchor.col, ctx.cursor.col);
      const endCol = Math.max(anchor.col, ctx.cursor.col) + 1;

      const lines = content.split("\n");
      const ranges: { anchor: number; head: number }[] = [];
      for (let line = startLine; line <= endLine; line++) {
        const lineLen = lines[line]?.length ?? 0;
        const from = cursorToOffset(content, { line, col: Math.min(startCol, lineLen) });
        const to = cursorToOffset(content, { line, col: Math.min(endCol, lineLen) });
        ranges.push({ anchor: from, head: to });
      }

      if (ranges.length > 0) {
        view.dispatch({
          selection: EditorSelection.create(
            ranges.map((r) => EditorSelection.range(r.anchor, r.head)),
            ranges.length - 1,
          ),
          scrollIntoView: true,
        });
      }
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

  // --- Sync cursor from CodeMirror selection (handles mouse clicks) ---
  // In visual modes the editor selection head represents the visual range
  // boundary, not the cursor position, so we must skip syncing there.
  function syncCursorFromEditor(): void {
    if (ctx.mode === "visual" || ctx.mode === "visual-line" || ctx.mode === "visual-block") {
      return;
    }
    const offset = view.state.selection.main.head;
    const editorCursor = offsetToCursor(buffer.getContent(), offset);
    if (editorCursor.line !== ctx.cursor.line || editorCursor.col !== ctx.cursor.col) {
      ctx = { ...ctx, cursor: editorCursor };
    }
  }

  // --- Keyboard handler ---
  function onKeyDown(e: KeyboardEvent): void {
    if (isComposing) return;

    // Sync cursor from CodeMirror selection before processing.
    // This ensures mouse clicks and other external selection changes
    // are reflected in the vim context.
    syncCursorFromEditor();

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
        e.stopPropagation();
        handleScroll(scroll.direction, scroll.amount);
        return;
      }
    }

    if (shouldPreventDefault(e)) {
      e.preventDefault();
      e.stopPropagation();
    }

    const { newCtx, actions } = processKeystroke(e.key, ctx, buffer, e.ctrlKey, readOnly);

    ctx = newCtx;
    processActions(actions, newCtx, e.key);

    // Sync search highlight: show only while typing /query or ?query
    const searchHighlight =
      ctx.commandType === "/" || ctx.commandType === "?" ? ctx.commandBuffer : "";
    if (searchHighlight !== prevSearchHighlight) {
      prevSearchHighlight = searchHighlight;
      cmDispatch({ effects: setSearchPattern.of(searchHighlight) });
    }
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
  target.addEventListener("keydown", onKeyDown, { capture: true });
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
      target.removeEventListener("keydown", onKeyDown, { capture: true });
      target.removeEventListener("compositionstart", onCompositionStart);
      target.removeEventListener("compositionend", onCompositionEnd);
    },
  };
}
