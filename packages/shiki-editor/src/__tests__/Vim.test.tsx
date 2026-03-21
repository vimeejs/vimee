/**
 * @vitest-environment happy-dom
 */

/**
 * Vim.test.tsx
 *
 * Tests for the Vim component and helper functions.
 * Uses a mock Shiki highlighter to avoid loading real grammars.
 */

import { describe, it, expect } from "vitest";
import { computeSelectionInfo } from "../Vim";
import { splitTokenBySelection } from "../components/Line";
import type { ThemedToken } from "shiki";

// =====================
// computeSelectionInfo
// =====================

describe("computeSelectionInfo", () => {
  it("returns no selection when not in visual mode", () => {
    const info = computeSelectionInfo("normal", null, { line: 0, col: 0 });
    expect(info.isLineSelected(0)).toBe(false);
    expect(info.getSelectionStartCol(0)).toBeUndefined();
    expect(info.getSelectionEndCol(0)).toBeUndefined();
  });

  it("returns no selection when anchor is null", () => {
    const info = computeSelectionInfo("visual", null, { line: 0, col: 0 });
    expect(info.isLineSelected(0)).toBe(false);
  });

  describe("visual (character-wise)", () => {
    it("selects single line range", () => {
      const info = computeSelectionInfo(
        "visual",
        { line: 0, col: 2 },
        { line: 0, col: 5 },
      );
      expect(info.isLineSelected(0)).toBe(true);
      expect(info.isLineSelected(1)).toBe(false);
      expect(info.getSelectionStartCol(0)).toBe(2);
      expect(info.getSelectionEndCol(0)).toBe(6); // exclusive
    });

    it("selects multi-line range (anchor before cursor)", () => {
      const info = computeSelectionInfo(
        "visual",
        { line: 1, col: 3 },
        { line: 3, col: 5 },
      );
      expect(info.isLineSelected(0)).toBe(false);
      expect(info.isLineSelected(1)).toBe(true);
      expect(info.isLineSelected(2)).toBe(true);
      expect(info.isLineSelected(3)).toBe(true);
      expect(info.isLineSelected(4)).toBe(false);

      // First line: from anchor col
      expect(info.getSelectionStartCol(1)).toBe(3);
      // Middle line: from 0 to Infinity
      expect(info.getSelectionStartCol(2)).toBe(0);
      expect(info.getSelectionEndCol(2)).toBe(Infinity);
      // Last line: to cursor col + 1
      expect(info.getSelectionEndCol(3)).toBe(6);
    });

    it("normalizes range when cursor is before anchor", () => {
      const info = computeSelectionInfo(
        "visual",
        { line: 2, col: 5 },
        { line: 0, col: 1 },
      );
      expect(info.isLineSelected(0)).toBe(true);
      expect(info.isLineSelected(1)).toBe(true);
      expect(info.isLineSelected(2)).toBe(true);
      expect(info.getSelectionStartCol(0)).toBe(1);
      expect(info.getSelectionEndCol(2)).toBe(6);
    });
  });

  describe("visual-line", () => {
    it("selects whole lines", () => {
      const info = computeSelectionInfo(
        "visual-line",
        { line: 1, col: 0 },
        { line: 3, col: 0 },
      );
      expect(info.isLineSelected(0)).toBe(false);
      expect(info.isLineSelected(1)).toBe(true);
      expect(info.isLineSelected(2)).toBe(true);
      expect(info.isLineSelected(3)).toBe(true);
      expect(info.isLineSelected(4)).toBe(false);
      // No column-level selection for visual-line
      expect(info.getSelectionStartCol(1)).toBeUndefined();
      expect(info.getSelectionEndCol(1)).toBeUndefined();
    });
  });

  describe("visual-block", () => {
    it("selects rectangular region", () => {
      const info = computeSelectionInfo(
        "visual-block",
        { line: 1, col: 2 },
        { line: 3, col: 5 },
      );
      expect(info.isLineSelected(0)).toBe(false);
      expect(info.isLineSelected(1)).toBe(true);
      expect(info.isLineSelected(2)).toBe(true);
      expect(info.isLineSelected(3)).toBe(true);

      // All selected lines have the same column range
      expect(info.getSelectionStartCol(1)).toBe(2);
      expect(info.getSelectionEndCol(1)).toBe(6);
      expect(info.getSelectionStartCol(2)).toBe(2);
      expect(info.getSelectionEndCol(2)).toBe(6);
    });

    it("normalizes block when cursor col < anchor col", () => {
      const info = computeSelectionInfo(
        "visual-block",
        { line: 0, col: 8 },
        { line: 2, col: 3 },
      );
      expect(info.getSelectionStartCol(1)).toBe(3);
      expect(info.getSelectionEndCol(1)).toBe(9);
    });
  });
});

// =====================
// splitTokenBySelection
// =====================

describe("splitTokenBySelection", () => {
  const makeToken = (content: string): ThemedToken =>
    ({ content, color: "#fff", offset: 0 }) as ThemedToken;

  it("splits token with selection in the middle", () => {
    const token = makeToken("hello world");
    const parts = splitTokenBySelection(token, 0, 2, 7);
    expect(parts).toEqual([
      { content: "he", selected: false },
      { content: "llo w", selected: true },
      { content: "orld", selected: false },
    ]);
  });

  it("splits token with selection at the start", () => {
    const token = makeToken("hello");
    const parts = splitTokenBySelection(token, 0, 0, 3);
    expect(parts).toEqual([
      { content: "hel", selected: true },
      { content: "lo", selected: false },
    ]);
  });

  it("splits token with selection at the end", () => {
    const token = makeToken("hello");
    const parts = splitTokenBySelection(token, 0, 3, 5);
    expect(parts).toEqual([
      { content: "hel", selected: false },
      { content: "lo", selected: true },
    ]);
  });

  it("selects entire token", () => {
    const token = makeToken("hello");
    const parts = splitTokenBySelection(token, 0, 0, 5);
    expect(parts).toEqual([{ content: "hello", selected: true }]);
  });

  it("handles token offset correctly", () => {
    const token = makeToken("world");
    // Token starts at column 5, selection is columns 7-9
    const parts = splitTokenBySelection(token, 5, 7, 9);
    expect(parts).toEqual([
      { content: "wo", selected: false },
      { content: "rl", selected: true },
      { content: "d", selected: false },
    ]);
  });
});
