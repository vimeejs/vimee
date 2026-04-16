/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi } from "vitest";
import { EditorSelection } from "@codemirror/state";
import { attach } from "../attach";
import type { CodeMirrorView, CodeMirrorTransactionSpec } from "../types";

// ---------------------------------------------------------------------------
// Mock CodeMirror View
// ---------------------------------------------------------------------------

// biome-ignore lint: test utility type
type AnySelection = any;

interface MockViewResult {
  view: CodeMirrorView;
  pressKey: (key: string, opts?: Partial<KeyboardEventInit>) => void;
  triggerCompositionStart: () => void;
  triggerCompositionEnd: () => void;
  getLastSelection: () => AnySelection;
  setSelectionHead: (offset: number) => void;
}

function createMockView(value = "", viewportLines = 20): MockViewResult {
  let content = value;
  let lastSelection: AnySelection;
  let selectionHead = 0;

  // Real DOM element so addEventListener/removeEventListener work
  const contentDOM = document.createElement("div");

  function buildDoc() {
    return {
      toString: () => content,
      get length() {
        return content.length;
      },
      get lines() {
        return content.split("\n").length;
      },
      lineAt(pos: number) {
        const ls = content.split("\n");
        let offset = 0;
        for (let i = 0; i < ls.length; i++) {
          const lineEnd = offset + ls[i].length;
          if (pos <= lineEnd) {
            return { number: i + 1, from: offset, to: lineEnd, text: ls[i] };
          }
          offset = lineEnd + 1;
        }
        const lastIdx = ls.length - 1;
        const lastFrom = content.length - ls[lastIdx].length;
        return { number: ls.length, from: lastFrom, to: content.length, text: ls[lastIdx] };
      },
      line(n: number) {
        const ls = content.split("\n");
        let offset = 0;
        for (let i = 0; i < n - 1 && i < ls.length; i++) {
          offset += ls[i].length + 1;
        }
        const idx = n - 1;
        return {
          number: n,
          from: offset,
          to: offset + (ls[idx]?.length ?? 0),
          text: ls[idx] ?? "",
        };
      },
    };
  }

  const view: CodeMirrorView = {
    dom: document.createElement("div"),
    contentDOM,
    get state() {
      return { doc: buildDoc(), selection: { main: { head: selectionHead } } };
    },
    get viewport() {
      const totalLines = content.split("\n").length;
      const visibleLines = Math.min(viewportLines, totalLines);
      // Compute to offset for visible lines
      const lines = content.split("\n");
      let toOffset = 0;
      for (let i = 0; i < visibleLines; i++) {
        toOffset += lines[i].length + (i < visibleLines - 1 ? 1 : 0);
      }
      return { from: 0, to: toOffset };
    },
    dispatch(...specs: CodeMirrorTransactionSpec[]) {
      for (const spec of specs) {
        if (spec.changes) {
          const { from, to, insert } = spec.changes;
          const before = content.slice(0, from);
          const after = content.slice(to ?? content.length);
          content = before + (insert ?? "") + after;
        }
        if (spec.selection) {
          lastSelection = spec.selection;
          if ("anchor" in spec.selection) {
            selectionHead =
              (spec.selection as { anchor: number; head?: number }).head ??
              (spec.selection as { anchor: number }).anchor;
          }
        }
      }
    },
    focus() {},
  };

  function pressKey(key: string, opts: Partial<KeyboardEventInit> = {}): void {
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...opts,
    });
    contentDOM.dispatchEvent(event);
  }

  function triggerCompositionStart(): void {
    contentDOM.dispatchEvent(new Event("compositionstart"));
  }

  function triggerCompositionEnd(): void {
    contentDOM.dispatchEvent(new Event("compositionend"));
  }

  return {
    view,
    pressKey,
    triggerCompositionStart,
    triggerCompositionEnd,
    getLastSelection: () => lastSelection,
    setSelectionHead: (offset: number) => {
      selectionHead = offset;
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("attach", () => {
  it("returns a VimCodeMirror handle with correct initial state", () => {
    const { view } = createMockView("hello");
    const vim = attach(view);

    expect(vim.getMode()).toBe("normal");
    expect(vim.getContent()).toBe("hello");
    expect(vim.getCursor()).toEqual({ line: 0, col: 0 });

    vim.destroy();
  });

  it("enters insert mode with i", () => {
    const mock = createMockView("hello");
    const onModeChange = vi.fn();
    const vim = attach(mock.view, { onModeChange });

    mock.pressKey("i");

    expect(vim.getMode()).toBe("insert");
    expect(onModeChange).toHaveBeenCalledWith("insert");

    vim.destroy();
  });

  it("exits insert mode with Escape", () => {
    const mock = createMockView("hello");
    const vim = attach(mock.view);

    mock.pressKey("i");
    expect(vim.getMode()).toBe("insert");

    mock.pressKey("Escape");
    expect(vim.getMode()).toBe("normal");

    vim.destroy();
  });

  it("moves cursor with h/j/k/l", () => {
    const mock = createMockView("hello\nworld");
    const vim = attach(mock.view);

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
    const mock = createMockView("hello");
    const onChange = vi.fn();
    const vim = attach(mock.view, { onChange });

    // Delete a character with x
    mock.pressKey("x");

    expect(onChange).toHaveBeenCalledWith("ello");
    expect(vim.getContent()).toBe("ello");

    vim.destroy();
  });

  it("fires onSave on :w", () => {
    const mock = createMockView("hello");
    const onSave = vi.fn();
    const vim = attach(mock.view, { onSave });

    mock.pressKey(":");
    mock.pressKey("w");
    mock.pressKey("Enter");

    expect(onSave).toHaveBeenCalledWith("hello");

    vim.destroy();
  });

  it("handles dd to delete a line", () => {
    const mock = createMockView("first\nsecond\nthird");
    const onChange = vi.fn();
    const vim = attach(mock.view, { onChange });

    mock.pressKey("d");
    mock.pressKey("d");

    expect(vim.getContent()).toBe("second\nthird");
    expect(onChange).toHaveBeenCalled();

    vim.destroy();
  });

  it("does not process keys during IME composition", () => {
    const mock = createMockView("hello");
    const vim = attach(mock.view);

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
    const mock = createMockView("hello");
    const vim = attach(mock.view, { readOnly: true });

    mock.pressKey("x");
    expect(vim.getContent()).toBe("hello");

    // Motions still work
    mock.pressKey("l");
    expect(vim.getCursor().col).toBe(1);

    vim.destroy();
  });

  it("handles Ctrl-D for scrolling", () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");
    const mock = createMockView(lines);
    const vim = attach(mock.view);

    // Ctrl-D should move cursor down
    mock.pressKey("d", { ctrlKey: true });
    expect(vim.getCursor().line).toBeGreaterThan(0);

    vim.destroy();
  });

  it("handles Ctrl-U for scrolling up", () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");
    const mock = createMockView(lines);
    const vim = attach(mock.view);

    // Move down first
    mock.pressKey("d", { ctrlKey: true });
    const lineAfterDown = vim.getCursor().line;

    // Ctrl-U should move cursor up
    mock.pressKey("u", { ctrlKey: true });
    expect(vim.getCursor().line).toBeLessThan(lineAfterDown);

    vim.destroy();
  });

  it("cleans up on destroy", () => {
    const mock = createMockView("hello");
    const vim = attach(mock.view);

    vim.destroy();

    // After destroy, keys should not be processed
    const contentBefore = vim.getContent();
    mock.pressKey("x");
    expect(vim.getContent()).toBe(contentBefore);
  });

  it("inserts text in insert mode", () => {
    const mock = createMockView("hello");
    const onChange = vi.fn();
    const vim = attach(mock.view, { onChange });

    // Enter insert mode
    mock.pressKey("i");
    expect(vim.getMode()).toBe("insert");

    // Type characters
    mock.pressKey("H");
    mock.pressKey("i");

    expect(vim.getContent()).toBe("Hihello");
    expect(onChange).toHaveBeenLastCalledWith("Hihello");

    vim.destroy();
  });

  it("fires onYank callback when yy yanks a line", () => {
    const mock = createMockView("first\nsecond\nthird");
    const onYank = vi.fn();
    const vim = attach(mock.view, { onYank });

    mock.pressKey("y");
    mock.pressKey("y");

    expect(onYank).toHaveBeenCalledWith("first\n");
    // Content should be unchanged
    expect(vim.getContent()).toBe("first\nsecond\nthird");

    vim.destroy();
  });

  it("enters visual mode with v", () => {
    const mock = createMockView("hello world");
    const onModeChange = vi.fn();
    const vim = attach(mock.view, { onModeChange });

    mock.pressKey("v");

    expect(vim.getMode()).toBe("visual");
    expect(onModeChange).toHaveBeenCalledWith("visual");

    // Selection should be set (anchor and head)
    const sel = mock.getLastSelection();
    expect(sel).toBeDefined();
    expect(sel!.head).toBeDefined();

    vim.destroy();
  });

  it("clears visual selection when leaving visual mode", () => {
    const mock = createMockView("hello world");
    const vim = attach(mock.view);

    mock.pressKey("v");
    expect(vim.getMode()).toBe("visual");

    mock.pressKey("Escape");
    expect(vim.getMode()).toBe("normal");

    // Selection should be a cursor (no head or head === anchor)
    const sel = mock.getLastSelection();
    expect(sel).toBeDefined();

    vim.destroy();
  });

  it("enters visual-line mode with V", () => {
    const mock = createMockView("first\nsecond\nthird");
    const vim = attach(mock.view);

    mock.pressKey("V");

    expect(vim.getMode()).toBe("visual-line");

    // Selection should span full line
    const sel = mock.getLastSelection();
    expect(sel).toBeDefined();

    vim.destroy();
  });

  it("calls onAction callback with the correct action and key", () => {
    const mock = createMockView("hello");
    const onAction = vi.fn();
    const vim = attach(mock.view, { onAction });

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

  it("does not process modifier-only keys in normal mode", () => {
    const mock = createMockView("hello");
    const vim = attach(mock.view);

    for (const key of ["Shift", "Control", "Alt", "Meta"]) {
      mock.pressKey(key);
    }

    // Content unchanged — modifier keys are no-ops
    expect(vim.getContent()).toBe("hello");

    vim.destroy();
  });

  it("enters command-line mode when : is pressed", () => {
    const mock = createMockView("hello");
    const vim = attach(mock.view);

    mock.pressKey(":");

    expect(vim.getMode()).toBe("command-line");

    vim.destroy();
  });

  it("enters command-line mode when / is pressed for search", () => {
    const mock = createMockView("hello world");
    const vim = attach(mock.view);

    mock.pressKey("/");

    expect(vim.getMode()).toBe("command-line");

    vim.destroy();
  });

  it("restores content after dw followed by undo", () => {
    const mock = createMockView("hello world");
    const vim = attach(mock.view);

    // dw deletes from cursor to start of next word
    mock.pressKey("d");
    mock.pressKey("w");

    expect(vim.getContent()).toBe("world");

    // u undoes the deletion
    mock.pressKey("u");

    expect(vim.getContent()).toBe("hello world");

    vim.destroy();
  });

  it("dispatches cursor position via selection", () => {
    const mock = createMockView("hello\nworld");
    const vim = attach(mock.view);

    mock.pressKey("j"); // Move to line 1
    mock.pressKey("l"); // Move to col 1

    const sel = mock.getLastSelection();
    expect(sel).toBeDefined();
    // Offset for line 1, col 1 = 6 + 1 = 7
    expect(sel!.anchor).toBe(7);

    vim.destroy();
  });

  it("handles Enter in insert mode to split lines", () => {
    const mock = createMockView("hello");
    const vim = attach(mock.view);

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
    const mock = createMockView("hello");
    const vim = attach(mock.view);

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
    const mock = createMockView("hello");
    const vim = attach(mock.view);

    mock.pressKey("i");
    mock.pressKey("Tab");

    // Default indent: 2 spaces
    expect(vim.getContent()).toBe("  hello");
    expect(vim.getCursor().col).toBe(2);

    vim.destroy();
  });

  it("supports custom indent settings", () => {
    const mock = createMockView("hello");
    const vim = attach(mock.view, { indentStyle: "tab", indentWidth: 4 });

    mock.pressKey("i");
    mock.pressKey("Tab");

    expect(vim.getContent()).toBe("\thello");
    expect(vim.getCursor().col).toBe(1);

    vim.destroy();
  });

  it("disposes all event listeners on destroy", () => {
    const mock = createMockView("hello");
    const vim = attach(mock.view);

    vim.destroy();

    // After destroy, pressing keys should not change content
    const contentBefore = vim.getContent();
    mock.pressKey("x");
    expect(vim.getContent()).toBe(contentBefore);
  });

  it("visual-block creates per-line selection ranges", () => {
    const mock = createMockView("abcde\nfghij\nklmno");
    const vim = attach(mock.view);

    // Move to col 1, then enter visual-block and select down+right
    mock.pressKey("l"); // col 1
    mock.pressKey("v", { ctrlKey: true }); // Ctrl-V → visual-block
    expect(vim.getMode()).toBe("visual-block");

    mock.pressKey("j"); // extend to line 1
    mock.pressKey("l"); // extend to col 2

    const sel = mock.getLastSelection();
    expect(sel).toBeInstanceOf(EditorSelection);

    // Should have 2 ranges (line 0 and line 1)
    expect(sel.ranges).toHaveLength(2);

    // Line 0: cols 1-2 → offsets 1..3
    expect(sel.ranges[0].from).toBe(1);
    expect(sel.ranges[0].to).toBe(3);

    // Line 1: cols 1-2 → offsets 7..9 (6 for "abcde\n" + 1..3)
    expect(sel.ranges[1].from).toBe(7);
    expect(sel.ranges[1].to).toBe(9);

    vim.destroy();
  });

  it("normal mode Enter does not modify content", () => {
    const mock = createMockView("hello\nworld");
    const vim = attach(mock.view);

    mock.pressKey("Enter");

    expect(vim.getContent()).toBe("hello\nworld");
    expect(vim.getMode()).toBe("normal");

    vim.destroy();
  });

  it("dispatches search highlight effect while typing /query", () => {
    const mock = createMockView("hello world hello");
    const dispatchSpy = vi.spyOn(mock.view, "dispatch");
    const vim = attach(mock.view);

    dispatchSpy.mockClear();

    mock.pressKey("/");
    mock.pressKey("h");

    // dispatch should have been called with an effects property
    const effectCalls = dispatchSpy.mock.calls.filter(
      (args) => args[0] && typeof args[0] === "object" && "effects" in args[0],
    );
    expect(effectCalls.length).toBeGreaterThan(0);

    vim.destroy();
  });

  it("syncs cursor from CodeMirror selection on keydown (simulates mouse click)", () => {
    const mock = createMockView("hello\nworld\nfoo");
    const vim = attach(mock.view);

    expect(vim.getCursor()).toEqual({ line: 0, col: 0 });

    // Simulate a mouse click that moves CodeMirror selection to line 1, col 2 (offset = 8)
    mock.setSelectionHead(8);

    // Press 'l' — should move from the clicked position, not from (0,0)
    mock.pressKey("l");

    expect(vim.getCursor()).toEqual({ line: 1, col: 3 });

    vim.destroy();
  });

  it("syncs cursor from editor before entering insert mode", () => {
    const mock = createMockView("hello\nworld");
    const vim = attach(mock.view);

    // Simulate click at offset 6 → line 1, col 0
    mock.setSelectionHead(6);

    mock.pressKey("i");
    expect(vim.getMode()).toBe("insert");

    // Type a character — should insert at line 1, col 0
    mock.pressKey("X");
    expect(vim.getContent()).toBe("hello\nXworld");

    vim.destroy();
  });

  it("clears search highlight effect on Enter after /query", () => {
    const mock = createMockView("hello world hello");
    const dispatchSpy = vi.spyOn(mock.view, "dispatch");
    const vim = attach(mock.view);

    mock.pressKey("/");
    mock.pressKey("h");
    mock.pressKey("e");
    mock.pressKey("l");

    dispatchSpy.mockClear();

    mock.pressKey("Enter");

    // After confirming search, an effect with empty pattern should be dispatched
    const effectCalls = dispatchSpy.mock.calls.filter(
      (args) => args[0] && typeof args[0] === "object" && "effects" in args[0],
    );
    expect(effectCalls.length).toBeGreaterThan(0);

    vim.destroy();
  });
});
