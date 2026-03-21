/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect } from "vitest";
import { cursorToOffset, offsetToCursor } from "../cursor";

describe("cursorToOffset", () => {
  it("converts first line, first col", () => {
    expect(cursorToOffset("hello\nworld", { line: 0, col: 0 })).toBe(0);
  });

  it("converts first line with col", () => {
    expect(cursorToOffset("hello\nworld", { line: 0, col: 3 })).toBe(3);
  });

  it("converts second line start", () => {
    expect(cursorToOffset("hello\nworld", { line: 1, col: 0 })).toBe(6);
  });

  it("converts second line with col", () => {
    expect(cursorToOffset("hello\nworld", { line: 1, col: 3 })).toBe(9);
  });

  it("handles single line content", () => {
    expect(cursorToOffset("hello", { line: 0, col: 5 })).toBe(5);
  });

  it("handles empty content", () => {
    expect(cursorToOffset("", { line: 0, col: 0 })).toBe(0);
  });

  it("clamps col to line length", () => {
    expect(cursorToOffset("hi\nbye", { line: 0, col: 10 })).toBe(2);
  });

  it("handles three lines", () => {
    expect(cursorToOffset("a\nbb\nccc", { line: 2, col: 2 })).toBe(7);
  });
});

describe("offsetToCursor", () => {
  it("converts offset 0", () => {
    expect(offsetToCursor("hello\nworld", 0)).toEqual({ line: 0, col: 0 });
  });

  it("converts offset in first line", () => {
    expect(offsetToCursor("hello\nworld", 3)).toEqual({ line: 0, col: 3 });
  });

  it("converts offset at line boundary", () => {
    expect(offsetToCursor("hello\nworld", 6)).toEqual({ line: 1, col: 0 });
  });

  it("converts offset in second line", () => {
    expect(offsetToCursor("hello\nworld", 9)).toEqual({ line: 1, col: 3 });
  });

  it("handles single line", () => {
    expect(offsetToCursor("hello", 3)).toEqual({ line: 0, col: 3 });
  });

  it("handles past end of content", () => {
    const result = offsetToCursor("hello", 100);
    expect(result.line).toBe(0);
  });

  it("handles empty content", () => {
    expect(offsetToCursor("", 0)).toEqual({ line: 0, col: 0 });
  });
});
