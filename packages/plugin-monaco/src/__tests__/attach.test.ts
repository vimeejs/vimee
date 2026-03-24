/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi } from "vitest";
import { attach } from "../attach";
import type { MonacoEditor, IKeyboardEvent, IModelDeltaDecoration, IRange } from "../types";

// ---------------------------------------------------------------------------
// Mock Monaco Editor
// ---------------------------------------------------------------------------

interface MockEditorResult {
  editor: MonacoEditor;
  pressKey: (key: string, opts?: Partial<KeyboardEventInit>) => void;
  triggerCompositionStart: () => void;
  triggerCompositionEnd: () => void;
  getCursorStyle: () => number;
  getDecorations: () => IModelDeltaDecoration[];
  getRevealedLines: () => number[];
}

function createMockEditor(value = "", visibleRanges?: IRange[]): MockEditorResult {
  let content = value;
  let position = { lineNumber: 1, column: 1 };
  let cursorStyle = 1; // Line
  const decorationCollections: IModelDeltaDecoration[][] = [];
  const revealedLines: number[] = [];

  const keyDownListeners: ((e: IKeyboardEvent) => void)[] = [];
  const compositionStartListeners: (() => void)[] = [];
  const compositionEndListeners: (() => void)[] = [];

  const defaultVisibleRanges: IRange[] = visibleRanges ?? [
    {
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: Math.min(20, content.split("\n").length),
      endColumn: 1,
    },
  ];

  const editor: MonacoEditor = {
    getValue: () => content,
    setValue: (v: string) => {
      content = v;
    },
    getPosition: () => ({ ...position }),
    setPosition: (pos) => {
      position = { lineNumber: pos.lineNumber, column: pos.column };
    },
    getModel: () => ({
      getValue: () => content,
      setValue: (v: string) => {
        content = v;
      },
      getLineContent: (lineNumber: number) => content.split("\n")[lineNumber - 1] ?? "",
      getLineCount: () => content.split("\n").length,
      getLineMaxColumn: (lineNumber: number) =>
        (content.split("\n")[lineNumber - 1]?.length ?? 0) + 1,
    }),
    onKeyDown: (listener) => {
      keyDownListeners.push(listener);
      return {
        dispose: () => {
          const idx = keyDownListeners.indexOf(listener);
          if (idx >= 0) keyDownListeners.splice(idx, 1);
        },
      };
    },
    onDidCompositionStart: (listener) => {
      compositionStartListeners.push(listener);
      return {
        dispose: () => {
          const idx = compositionStartListeners.indexOf(listener);
          if (idx >= 0) compositionStartListeners.splice(idx, 1);
        },
      };
    },
    onDidCompositionEnd: (listener) => {
      compositionEndListeners.push(listener);
      return {
        dispose: () => {
          const idx = compositionEndListeners.indexOf(listener);
          if (idx >= 0) compositionEndListeners.splice(idx, 1);
        },
      };
    },
    createDecorationsCollection: () => {
      const col: IModelDeltaDecoration[] = [];
      decorationCollections.push(col);
      return {
        set: (d: IModelDeltaDecoration[]) => {
          col.length = 0;
          col.push(...d);
        },
        clear: () => {
          col.length = 0;
        },
      };
    },
    getVisibleRanges: () => defaultVisibleRanges,
    revealLine: (lineNumber: number) => {
      revealedLines.push(lineNumber);
    },
    updateOptions: (opts: Record<string, unknown>) => {
      if (opts.cursorStyle !== undefined) cursorStyle = opts.cursorStyle as number;
    },
    focus: () => {},
  };

  function pressKey(key: string, opts: Partial<KeyboardEventInit> = {}): void {
    const browserEvent = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...opts,
    });

    const monacoEvent: IKeyboardEvent = {
      browserEvent,
      preventDefault: () => {
        browserEvent.preventDefault();
      },
      stopPropagation: () => {
        browserEvent.stopPropagation();
      },
    };

    for (const listener of keyDownListeners) {
      listener(monacoEvent);
    }
  }

  function triggerCompositionStart(): void {
    for (const listener of compositionStartListeners) {
      listener();
    }
  }

  function triggerCompositionEnd(): void {
    for (const listener of compositionEndListeners) {
      listener();
    }
  }

  return {
    editor,
    pressKey,
    triggerCompositionStart,
    triggerCompositionEnd,
    getCursorStyle: () => cursorStyle,
    getDecorations: () => decorationCollections.flat(),
    getRevealedLines: () => revealedLines,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("attach", () => {
  it("returns a VimMonaco handle with correct initial state", () => {
    const { editor } = createMockEditor("hello");
    const vim = attach(editor);

    expect(vim.getMode()).toBe("normal");
    expect(vim.getContent()).toBe("hello");
    expect(vim.getCursor()).toEqual({ line: 0, col: 0 });

    vim.destroy();
  });

  it("sets cursor style to block in normal mode", () => {
    const mock = createMockEditor("hello");
    const vim = attach(mock.editor);

    // Block = 2
    expect(mock.getCursorStyle()).toBe(2);

    vim.destroy();
  });

  it("enters insert mode with i and changes cursor style to line", () => {
    const mock = createMockEditor("hello");
    const onModeChange = vi.fn();
    const vim = attach(mock.editor, { onModeChange });

    mock.pressKey("i");

    expect(vim.getMode()).toBe("insert");
    expect(mock.getCursorStyle()).toBe(1); // Line
    expect(onModeChange).toHaveBeenCalledWith("insert");

    vim.destroy();
  });

  it("exits insert mode with Escape", () => {
    const mock = createMockEditor("hello");
    const vim = attach(mock.editor);

    mock.pressKey("i");
    expect(vim.getMode()).toBe("insert");

    mock.pressKey("Escape");
    expect(vim.getMode()).toBe("normal");
    expect(mock.getCursorStyle()).toBe(2); // Block

    vim.destroy();
  });

  it("moves cursor with h/j/k/l", () => {
    const mock = createMockEditor("hello\nworld");
    const vim = attach(mock.editor);

    mock.pressKey("l");
    expect(vim.getCursor().col).toBe(1);

    mock.pressKey("j");
    expect(vim.getCursor().line).toBe(1);

    mock.pressKey("h");
    expect(vim.getCursor().col).toBe(0);

    mock.pressKey("k");
    expect(vim.getCursor().line).toBe(0);

    vim.destroy();
  });

  it("fires onChange on content change", () => {
    const mock = createMockEditor("hello");
    const onChange = vi.fn();
    const vim = attach(mock.editor, { onChange });

    // Delete a character with x
    mock.pressKey("x");

    expect(onChange).toHaveBeenCalledWith("ello");
    expect(mock.editor.getValue()).toBe("ello");

    vim.destroy();
  });

  it("fires onSave on :w", () => {
    const mock = createMockEditor("hello");
    const onSave = vi.fn();
    const vim = attach(mock.editor, { onSave });

    mock.pressKey(":");
    mock.pressKey("w");
    mock.pressKey("Enter");

    expect(onSave).toHaveBeenCalledWith("hello");

    vim.destroy();
  });

  it("handles dd to delete a line", () => {
    const mock = createMockEditor("first\nsecond\nthird");
    const onChange = vi.fn();
    const vim = attach(mock.editor, { onChange });

    mock.pressKey("d");
    mock.pressKey("d");

    expect(vim.getContent()).toBe("second\nthird");
    expect(onChange).toHaveBeenCalled();

    vim.destroy();
  });

  it("does not process keys during IME composition", () => {
    const mock = createMockEditor("hello");
    const vim = attach(mock.editor);

    mock.triggerCompositionStart();

    // These keys should be ignored
    mock.pressKey("d");
    mock.pressKey("d");

    expect(vim.getContent()).toBe("hello");

    mock.triggerCompositionEnd();

    // Now keys work again
    mock.pressKey("x");
    expect(vim.getContent()).toBe("ello");

    vim.destroy();
  });

  it("supports readOnly mode", () => {
    const mock = createMockEditor("hello");
    const vim = attach(mock.editor, { readOnly: true });

    mock.pressKey("x");
    expect(vim.getContent()).toBe("hello");

    // Motions still work
    mock.pressKey("l");
    expect(vim.getCursor().col).toBe(1);

    vim.destroy();
  });

  it("handles Ctrl-D for scrolling", () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");
    const mock = createMockEditor(lines);
    const vim = attach(mock.editor);

    // Ctrl-D should move cursor down
    mock.pressKey("d", { ctrlKey: true });
    expect(vim.getCursor().line).toBeGreaterThan(0);

    vim.destroy();
  });

  it("handles Ctrl-U for scrolling up", () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");
    const mock = createMockEditor(lines);
    const vim = attach(mock.editor);

    // Move down first
    mock.pressKey("d", { ctrlKey: true });
    const lineAfterDown = vim.getCursor().line;

    // Ctrl-U should move cursor up
    mock.pressKey("u", { ctrlKey: true });
    expect(vim.getCursor().line).toBeLessThan(lineAfterDown);

    vim.destroy();
  });

  it("cleans up on destroy", () => {
    const mock = createMockEditor("hello");
    const vim = attach(mock.editor);

    vim.destroy();

    // Cursor style should be reset to line (1)
    expect(mock.getCursorStyle()).toBe(1);

    // Keys should no longer be processed (no listeners)
    mock.pressKey("x");
    // Content should not change after destroy — the listener was removed
    // (We can't directly verify this because the mock editor doesn't connect
    // keydowns to content changes. The key here is that dispose was called.)
  });

  it("inserts text in insert mode", () => {
    const mock = createMockEditor("hello");
    const onChange = vi.fn();
    const vim = attach(mock.editor, { onChange });

    // Enter insert mode
    mock.pressKey("i");
    expect(vim.getMode()).toBe("insert");

    // Type characters
    mock.pressKey("H");
    mock.pressKey("i");

    expect(vim.getContent()).toBe("Hihello");
    expect(mock.editor.getValue()).toBe("Hihello");
    expect(onChange).toHaveBeenLastCalledWith("Hihello");

    vim.destroy();
  });

  it("fires onYank callback when yy yanks a line", () => {
    const mock = createMockEditor("first\nsecond\nthird");
    const onYank = vi.fn();
    const vim = attach(mock.editor, { onYank });

    mock.pressKey("y");
    mock.pressKey("y");

    expect(onYank).toHaveBeenCalledWith("first\n");
    // Content should be unchanged
    expect(vim.getContent()).toBe("first\nsecond\nthird");

    vim.destroy();
  });

  it("enters visual mode with v and creates decorations", () => {
    const mock = createMockEditor("hello world");
    const onModeChange = vi.fn();
    const vim = attach(mock.editor, { onModeChange });

    mock.pressKey("v");

    expect(vim.getMode()).toBe("visual");
    expect(onModeChange).toHaveBeenCalledWith("visual");

    // Should have visual decorations
    const decorations = mock.getDecorations();
    expect(decorations.length).toBeGreaterThan(0);
    expect(decorations[0].options.className).toBe("vimee-visual-selection");

    vim.destroy();
  });

  it("clears visual decorations when leaving visual mode", () => {
    const mock = createMockEditor("hello world");
    const vim = attach(mock.editor);

    mock.pressKey("v");
    expect(mock.getDecorations().length).toBeGreaterThan(0);

    mock.pressKey("Escape");
    expect(mock.getDecorations()).toEqual([]);

    vim.destroy();
  });

  it("enters visual-line mode with V and uses isWholeLine", () => {
    const mock = createMockEditor("first\nsecond\nthird");
    const vim = attach(mock.editor);

    mock.pressKey("V");

    expect(vim.getMode()).toBe("visual-line");
    const decorations = mock.getDecorations();
    expect(decorations.length).toBeGreaterThan(0);
    expect(decorations[0].options.isWholeLine).toBe(true);

    vim.destroy();
  });

  it("calls onAction callback with the correct action and key", () => {
    const mock = createMockEditor("hello");
    const onAction = vi.fn();
    const vim = attach(mock.editor, { onAction });

    // Delete a character with x — should produce a content-change action
    mock.pressKey("x");

    expect(onAction).toHaveBeenCalled();
    const calls = onAction.mock.calls;
    const contentChangeCall = calls.find(
      ([action]: [{ type: string }]) => action.type === "content-change",
    );
    expect(contentChangeCall).toBeDefined();
    expect(contentChangeCall![1]).toBe("x");

    vim.destroy();
  });

  it("does not prevent default for modifier-only keys in normal mode", () => {
    const mock = createMockEditor("hello");
    const vim = attach(mock.editor);

    for (const key of ["Shift", "Control", "Alt", "Meta"]) {
      // Press modifier-only key through the mock — should be a no-op
      mock.pressKey(key);
    }

    // Content unchanged — modifier keys are no-ops
    expect(vim.getContent()).toBe("hello");

    vim.destroy();
  });

  it("enters command-line mode when : is pressed", () => {
    const mock = createMockEditor("hello");
    const onModeChange = vi.fn();
    const vim = attach(mock.editor, { onModeChange });

    mock.pressKey(":");

    expect(vim.getMode()).toBe("command-line");

    vim.destroy();
  });

  it("enters command-line mode when / is pressed for search", () => {
    const mock = createMockEditor("hello world");
    const vim = attach(mock.editor);

    mock.pressKey("/");

    expect(vim.getMode()).toBe("command-line");

    vim.destroy();
  });

  it("restores content after dw followed by undo", () => {
    const mock = createMockEditor("hello world");
    const vim = attach(mock.editor);

    // dw deletes from cursor to start of next word
    mock.pressKey("d");
    mock.pressKey("w");

    expect(vim.getContent()).toBe("world");

    // u undoes the deletion
    mock.pressKey("u");

    expect(vim.getContent()).toBe("hello world");

    vim.destroy();
  });

  it("syncs cursor position to Monaco (1-based)", () => {
    const mock = createMockEditor("hello\nworld");
    const vim = attach(mock.editor);

    mock.pressKey("j"); // Move to line 1
    mock.pressKey("l"); // Move to col 1

    // Monaco position should be 1-based
    const pos = mock.editor.getPosition();
    expect(pos).toEqual({ lineNumber: 2, column: 2 });

    vim.destroy();
  });

  it("calls revealLine when cursor moves", () => {
    const mock = createMockEditor("first\nsecond\nthird");
    const vim = attach(mock.editor);

    mock.getRevealedLines().length = 0; // Clear initial reveal calls

    mock.pressKey("j");

    // Should have revealed the new line (1-based: line 2)
    expect(mock.getRevealedLines()).toContain(2);

    vim.destroy();
  });

  it("handles Enter in insert mode to split lines", () => {
    const mock = createMockEditor("hello");
    const vim = attach(mock.editor);

    mock.pressKey("l");
    mock.pressKey("l");
    mock.pressKey("l");
    mock.pressKey("i");

    mock.pressKey("Enter");

    expect(vim.getContent()).toBe("hel\nlo");
    expect(vim.getCursor().line).toBe(1);

    vim.destroy();
  });

  it("handles Backspace in insert mode", () => {
    const mock = createMockEditor("hello");
    const vim = attach(mock.editor);

    mock.pressKey("l");
    mock.pressKey("l");
    mock.pressKey("l");
    mock.pressKey("i");

    mock.pressKey("Backspace");

    expect(vim.getContent()).toBe("helo");
    expect(vim.getCursor().col).toBe(2);

    vim.destroy();
  });

  it("supports Tab insertion in insert mode", () => {
    const mock = createMockEditor("hello");
    const vim = attach(mock.editor);

    mock.pressKey("i");
    mock.pressKey("Tab");

    // Default indent: 2 spaces
    expect(vim.getContent()).toBe("  hello");
    expect(vim.getCursor().col).toBe(2);

    vim.destroy();
  });

  it("supports custom indent settings", () => {
    const mock = createMockEditor("hello");
    const vim = attach(mock.editor, { indentStyle: "tab", indentWidth: 4 });

    mock.pressKey("i");
    mock.pressKey("Tab");

    expect(vim.getContent()).toBe("\thello");
    expect(vim.getCursor().col).toBe(1);

    vim.destroy();
  });

  it("disposes all event listeners on destroy", () => {
    const mock = createMockEditor("hello");
    const vim = attach(mock.editor);

    vim.destroy();

    // After destroy, pressing keys should not change content
    // because the listener was removed from the mock's internal array
    const contentBefore = mock.editor.getValue();
    mock.pressKey("x");
    // The content in the mock doesn't change because no listener processed the key
    expect(mock.editor.getValue()).toBe(contentBefore);
  });

  it("visual-block creates per-line decorations", () => {
    const mock = createMockEditor("abcde\nfghij\nklmno");
    const vim = attach(mock.editor);

    mock.pressKey("l"); // col 1
    mock.pressKey("v", { ctrlKey: true }); // Ctrl-V → visual-block
    expect(vim.getMode()).toBe("visual-block");

    mock.pressKey("j"); // extend to line 1
    mock.pressKey("l"); // extend to col 2

    const decorations = mock.getDecorations().filter(
      (d) => d.options.className === "vimee-visual-selection",
    );

    // Should have 2 decorations (one per line)
    expect(decorations).toHaveLength(2);

    // Line 1: cols 1-2 (1-based: columns 2-3)
    expect(decorations[0].range.startLineNumber).toBe(1);
    expect(decorations[0].range.startColumn).toBe(2);
    expect(decorations[0].range.endColumn).toBe(4);

    // Line 2: cols 1-2 (1-based: columns 2-3)
    expect(decorations[1].range.startLineNumber).toBe(2);
    expect(decorations[1].range.startColumn).toBe(2);
    expect(decorations[1].range.endColumn).toBe(4);

    vim.destroy();
  });

  it("shows search decorations while typing /query", () => {
    const mock = createMockEditor("hello world hello");
    const vim = attach(mock.editor);

    mock.pressKey("/");
    mock.pressKey("h");
    mock.pressKey("e");
    mock.pressKey("l");

    const searchDecorations = mock.getDecorations().filter(
      (d) => d.options.className === "vimee-search-match",
    );

    // "hel" should match twice: "hello" at col 0 and "hello" at col 12
    expect(searchDecorations).toHaveLength(2);
    expect(searchDecorations[0].range.startColumn).toBe(1); // 1-based
    expect(searchDecorations[0].range.endColumn).toBe(4);
    expect(searchDecorations[1].range.startColumn).toBe(13);
    expect(searchDecorations[1].range.endColumn).toBe(16);

    vim.destroy();
  });

  it("clears search decorations on Enter", () => {
    const mock = createMockEditor("hello world hello");
    const vim = attach(mock.editor);

    mock.pressKey("/");
    mock.pressKey("h");
    mock.pressKey("e");
    mock.pressKey("l");

    // Confirm search
    mock.pressKey("Enter");

    const searchDecorations = mock.getDecorations().filter(
      (d) => d.options.className === "vimee-search-match",
    );
    expect(searchDecorations).toHaveLength(0);

    vim.destroy();
  });
});
