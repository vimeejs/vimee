import { describe, it, expect, vi } from "vitest";
import { getTopLine, getVisibleLines, revealLine } from "../viewport";
import type { MonacoEditor, IRange } from "../types";

function createMockEditor(visibleRanges: IRange[] = []): MonacoEditor {
  const revealLineSpy = vi.fn();
  return {
    getValue: () => "",
    setValue: () => {},
    getPosition: () => ({ lineNumber: 1, column: 1 }),
    setPosition: () => {},
    getModel: () => null,
    onKeyDown: () => ({ dispose: () => {} }),
    onDidCompositionStart: () => ({ dispose: () => {} }),
    onDidCompositionEnd: () => ({ dispose: () => {} }),
    createDecorationsCollection: () => ({ set: () => {}, clear: () => {} }),
    getVisibleRanges: () => visibleRanges,
    revealLine: revealLineSpy,
    updateOptions: () => {},
    focus: () => {},
  };
}

describe("getTopLine", () => {
  it("returns the first visible line (0-based)", () => {
    const editor = createMockEditor([
      { startLineNumber: 5, startColumn: 1, endLineNumber: 25, endColumn: 1 },
    ]);
    expect(getTopLine(editor)).toBe(4); // 5 - 1
  });

  it("returns 0 when no visible ranges", () => {
    const editor = createMockEditor([]);
    expect(getTopLine(editor)).toBe(0);
  });
});

describe("getVisibleLines", () => {
  it("returns the visible line count from ranges", () => {
    const editor = createMockEditor([
      { startLineNumber: 1, startColumn: 1, endLineNumber: 20, endColumn: 1 },
    ]);
    expect(getVisibleLines(editor)).toBe(20);
  });

  it("returns fallback 20 when no visible ranges", () => {
    const editor = createMockEditor([]);
    expect(getVisibleLines(editor)).toBe(20);
  });

  it("handles multiple visible ranges", () => {
    const editor = createMockEditor([
      { startLineNumber: 10, startColumn: 1, endLineNumber: 20, endColumn: 1 },
      { startLineNumber: 22, startColumn: 1, endLineNumber: 30, endColumn: 1 },
    ]);
    // From line 10 to line 30 = 21 lines
    expect(getVisibleLines(editor)).toBe(21);
  });
});

describe("revealLine", () => {
  it("calls editor.revealLine with 1-based line number", () => {
    const editor = createMockEditor();
    revealLine(editor, 0);
    expect(editor.revealLine).toHaveBeenCalledWith(1);
  });

  it("converts 0-based to 1-based correctly", () => {
    const editor = createMockEditor();
    revealLine(editor, 9);
    expect(editor.revealLine).toHaveBeenCalledWith(10);
  });
});
