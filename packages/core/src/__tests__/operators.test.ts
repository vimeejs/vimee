/**
 * operators.test.ts
 *
 * Unit tests for operators (d, y, c) and
 * verification of executeOperatorOnRange / executeLineOperator behavior.
 */

import { describe, it, expect } from "vitest";
import { executeOperatorOnRange, executeLineOperator } from "../operators";
import type { MotionRange } from "../motions";
import { TextBuffer } from "../buffer";

// =====================
// Tests
// =====================

describe("Operators", () => {
  // ---------------------------------------------------
  // executeOperatorOnRange: character-wise delete
  // ---------------------------------------------------
  describe("executeOperatorOnRange - character-wise delete", () => {
    it("deletes a one-word range", () => {
      const buffer = new TextBuffer("hello world");
      // dw: w motion's end is the start of the next word (col 6), inclusive: false
      const range: MotionRange = {
        start: { line: 0, col: 0 },
        end: { line: 0, col: 6 },
        linewise: false,
        inclusive: false,
      };
      const result = executeOperatorOnRange(
        "d",
        range,
        buffer,
        { line: 0, col: 0 },
      );
      expect(buffer.getContent()).toBe("world");
      expect(result.newCursor.col).toBe(0);
      expect(result.newMode).toBe("normal");
      expect(result.yankedText).toBe("hello ");
    });

    it("deletes including the last character for an inclusive range", () => {
      const buffer = new TextBuffer("hello");
      const range: MotionRange = {
        start: { line: 0, col: 0 },
        end: { line: 0, col: 2 },
        linewise: false,
        inclusive: true,
      };
      const result = executeOperatorOnRange(
        "d",
        range,
        buffer,
        { line: 0, col: 0 },
      );
      expect(buffer.getContent()).toBe("lo");
      expect(result.yankedText).toBe("hel");
    });

    it("normalizes and processes when start > end", () => {
      const buffer = new TextBuffer("hello");
      const range: MotionRange = {
        start: { line: 0, col: 3 },
        end: { line: 0, col: 0 },
        linewise: false,
        inclusive: false,
      };
      const result = executeOperatorOnRange(
        "d",
        range,
        buffer,
        { line: 0, col: 3 },
      );
      expect(buffer.getContent()).toBe("lo");
      expect(result.newCursor.col).toBe(0);
    });

    it("deletes a range spanning multiple lines", () => {
      const buffer = new TextBuffer("hello\nworld\nfoo");
      const range: MotionRange = {
        start: { line: 0, col: 3 },
        end: { line: 1, col: 3 },
        linewise: false,
        inclusive: false,
      };
      const result = executeOperatorOnRange(
        "d",
        range,
        buffer,
        { line: 0, col: 3 },
      );
      expect(buffer.getContent()).toBe("helld\nfoo");
      expect(result.yankedText).toBe("lo\nwor");
    });
  });

  // ---------------------------------------------------
  // executeOperatorOnRange: character-wise yank
  // ---------------------------------------------------
  describe("executeOperatorOnRange - character-wise yank", () => {
    it("yanks without deleting", () => {
      const buffer = new TextBuffer("hello world");
      // yw: w motion's end is the start of the next word (col 6), inclusive: false
      const range: MotionRange = {
        start: { line: 0, col: 0 },
        end: { line: 0, col: 6 },
        linewise: false,
        inclusive: false,
      };
      const result = executeOperatorOnRange(
        "y",
        range,
        buffer,
        { line: 0, col: 0 },
      );
      expect(buffer.getContent()).toBe("hello world");
      expect(result.yankedText).toBe("hello ");
      expect(result.newMode).toBe("normal");
    });

    it("moves cursor to the start of the range after yank", () => {
      const buffer = new TextBuffer("hello world");
      const range: MotionRange = {
        start: { line: 0, col: 6 },
        end: { line: 0, col: 10 },
        linewise: false,
        inclusive: true,
      };
      const result = executeOperatorOnRange(
        "y",
        range,
        buffer,
        { line: 0, col: 6 },
      );
      expect(result.newCursor).toEqual({ line: 0, col: 6 });
      expect(result.yankedText).toBe("world");
    });
  });

  // ---------------------------------------------------
  // executeOperatorOnRange: character-wise change
  // ---------------------------------------------------
  describe("executeOperatorOnRange - character-wise change", () => {
    it("deletes the range and transitions to insert mode", () => {
      const buffer = new TextBuffer("hello world");
      // cw: w motion's end is the start of the next word (col 6), inclusive: false
      const range: MotionRange = {
        start: { line: 0, col: 0 },
        end: { line: 0, col: 6 },
        linewise: false,
        inclusive: false,
      };
      const result = executeOperatorOnRange(
        "c",
        range,
        buffer,
        { line: 0, col: 0 },
      );
      expect(buffer.getContent()).toBe("world");
      expect(result.newMode).toBe("insert");
      expect(result.newCursor.col).toBe(0);
    });

    it("cursor is at the start of the deleted range after change", () => {
      const buffer = new TextBuffer("hello world");
      const range: MotionRange = {
        start: { line: 0, col: 6 },
        end: { line: 0, col: 10 },
        linewise: false,
        inclusive: true,
      };
      const result = executeOperatorOnRange(
        "c",
        range,
        buffer,
        { line: 0, col: 6 },
      );
      expect(result.newCursor.col).toBe(6);
    });
  });

  // ---------------------------------------------------
  // executeOperatorOnRange: line-wise operations
  // ---------------------------------------------------
  describe("executeOperatorOnRange - line-wise operations", () => {
    it("deletes entire lines with line-wise delete", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const range: MotionRange = {
        start: { line: 0, col: 0 },
        end: { line: 1, col: 0 },
        linewise: true,
        inclusive: true,
      };
      const result = executeOperatorOnRange(
        "d",
        range,
        buffer,
        { line: 0, col: 0 },
      );
      expect(buffer.getContent()).toBe("line3");
      expect(result.yankedText).toBe("line1\nline2\n");
    });

    it("does not modify the buffer with line-wise yank", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const range: MotionRange = {
        start: { line: 0, col: 0 },
        end: { line: 1, col: 0 },
        linewise: true,
        inclusive: true,
      };
      const result = executeOperatorOnRange(
        "y",
        range,
        buffer,
        { line: 0, col: 0 },
      );
      expect(buffer.getContent()).toBe("line1\nline2\nline3");
      expect(result.yankedText).toBe("line1\nline2\n");
    });

    it("deletes lines and inserts an empty line in insert mode with line-wise change", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const range: MotionRange = {
        start: { line: 1, col: 0 },
        end: { line: 1, col: 0 },
        linewise: true,
        inclusive: true,
      };
      const result = executeOperatorOnRange(
        "c",
        range,
        buffer,
        { line: 1, col: 0 },
      );
      expect(result.newMode).toBe("insert");
      expect(result.newCursor).toEqual({ line: 1, col: 0 });
      expect(buffer.getLine(1)).toBe("");
    });
  });

  // ---------------------------------------------------
  // executeLineOperator (dd, yy, cc)
  // ---------------------------------------------------
  describe("executeLineOperator", () => {
    it("deletes 1 line with dd (count=1)", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const result = executeLineOperator(
        "d",
        { line: 1, col: 0 },
        1,
        buffer,
      );
      expect(buffer.getContent()).toBe("line1\nline3");
      expect(result.yankedText).toBe("line2\n");
    });

    it("deletes 2 lines with 2dd", () => {
      const buffer = new TextBuffer("line1\nline2\nline3\nline4");
      const result = executeLineOperator(
        "d",
        { line: 1, col: 0 },
        2,
        buffer,
      );
      expect(buffer.getContent()).toBe("line1\nline4");
      expect(result.yankedText).toBe("line2\nline3\n");
    });

    it("yanks 1 line with yy", () => {
      const buffer = new TextBuffer("line1\nline2");
      const result = executeLineOperator(
        "y",
        { line: 0, col: 0 },
        1,
        buffer,
      );
      expect(buffer.getContent()).toBe("line1\nline2");
      expect(result.yankedText).toBe("line1\n");
    });

    it("changes a line with cc", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const result = executeLineOperator(
        "c",
        { line: 1, col: 0 },
        1,
        buffer,
      );
      expect(result.newMode).toBe("insert");
      expect(buffer.getLine(1)).toBe("");
    });
  });

  // ---------------------------------------------------
  // Edge cases
  // ---------------------------------------------------
  describe("Edge cases", () => {
    it("leaves one empty line in the buffer when deleting all lines", () => {
      const buffer = new TextBuffer("only line");
      const result = executeLineOperator(
        "d",
        { line: 0, col: 0 },
        1,
        buffer,
      );
      expect(buffer.getContent()).toBe("");
      expect(buffer.getLineCount()).toBe(1);
      expect(result.newCursor.line).toBe(0);
    });

    it("clamps when count exceeds the buffer line count", () => {
      const buffer = new TextBuffer("line1\nline2");
      const result = executeLineOperator(
        "d",
        { line: 0, col: 0 },
        100,
        buffer,
      );
      // All lines deleted
      expect(buffer.getLineCount()).toBe(1);
      expect(buffer.getContent()).toBe("");
    });

    it("executes line-wise yank on an empty buffer", () => {
      const buffer = new TextBuffer("");
      const result = executeLineOperator(
        "y",
        { line: 0, col: 0 },
        1,
        buffer,
      );
      expect(result.yankedText).toBe("\n");
      expect(buffer.getContent()).toBe("");
    });

    it("executes character-wise delete on a single-line buffer", () => {
      const buffer = new TextBuffer("abc");
      const range: MotionRange = {
        start: { line: 0, col: 0 },
        end: { line: 0, col: 2 },
        linewise: false,
        inclusive: true,
      };
      const result = executeOperatorOnRange(
        "d",
        range,
        buffer,
        { line: 0, col: 0 },
      );
      expect(buffer.getContent()).toBe("");
      expect(result.newCursor.col).toBe(0);
    });
  });

  // ---------------------------------------------------
  // Indent / Dedent operators (> and <)
  // ---------------------------------------------------
  describe("executeOperatorOnRange - indent (>)", () => {
    it("indents a single line with spaces (default)", () => {
      const buffer = new TextBuffer("hello\nworld\nfoo");
      const range: MotionRange = {
        start: { line: 0, col: 0 },
        end: { line: 0, col: 0 },
        linewise: true,
        inclusive: true,
      };
      const result = executeOperatorOnRange(
        ">",
        range,
        buffer,
        { line: 0, col: 0 },
      );
      expect(buffer.getLine(0)).toBe("  hello");
      expect(result.newCursor).toEqual({ line: 0, col: 0 });
      expect(result.newMode).toBe("normal");
    });

    it("indents multiple lines", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const range: MotionRange = {
        start: { line: 0, col: 0 },
        end: { line: 1, col: 0 },
        linewise: true,
        inclusive: true,
      };
      const result = executeOperatorOnRange(
        ">",
        range,
        buffer,
        { line: 0, col: 0 },
      );
      expect(buffer.getLine(0)).toBe("  line1");
      expect(buffer.getLine(1)).toBe("  line2");
      expect(buffer.getLine(2)).toBe("line3");
      expect(result.statusMessage).toContain("2 lines");
    });

    it("indents with tab style", () => {
      const buffer = new TextBuffer("hello");
      const range: MotionRange = {
        start: { line: 0, col: 0 },
        end: { line: 0, col: 0 },
        linewise: true,
        inclusive: true,
      };
      executeOperatorOnRange(
        ">",
        range,
        buffer,
        { line: 0, col: 0 },
        { style: "tab", width: 4 },
      );
      expect(buffer.getLine(0)).toBe("\thello");
    });

    it("indents with custom width", () => {
      const buffer = new TextBuffer("hello");
      const range: MotionRange = {
        start: { line: 0, col: 0 },
        end: { line: 0, col: 0 },
        linewise: true,
        inclusive: true,
      };
      executeOperatorOnRange(
        ">",
        range,
        buffer,
        { line: 0, col: 0 },
        { style: "space", width: 4 },
      );
      expect(buffer.getLine(0)).toBe("    hello");
    });
  });

  describe("executeOperatorOnRange - dedent (<)", () => {
    it("dedents a line with leading spaces", () => {
      const buffer = new TextBuffer("  hello\nworld");
      const range: MotionRange = {
        start: { line: 0, col: 0 },
        end: { line: 0, col: 0 },
        linewise: true,
        inclusive: true,
      };
      executeOperatorOnRange(
        "<",
        range,
        buffer,
        { line: 0, col: 0 },
      );
      expect(buffer.getLine(0)).toBe("hello");
    });

    it("dedents a line with leading tab", () => {
      const buffer = new TextBuffer("\thello");
      const range: MotionRange = {
        start: { line: 0, col: 0 },
        end: { line: 0, col: 0 },
        linewise: true,
        inclusive: true,
      };
      executeOperatorOnRange(
        "<",
        range,
        buffer,
        { line: 0, col: 0 },
      );
      expect(buffer.getLine(0)).toBe("hello");
    });

    it("dedents partially when fewer spaces than indent width", () => {
      const buffer = new TextBuffer(" hello");
      const range: MotionRange = {
        start: { line: 0, col: 0 },
        end: { line: 0, col: 0 },
        linewise: true,
        inclusive: true,
      };
      executeOperatorOnRange(
        "<",
        range,
        buffer,
        { line: 0, col: 0 },
      );
      expect(buffer.getLine(0)).toBe("hello");
    });

    it("does nothing when no leading whitespace", () => {
      const buffer = new TextBuffer("hello");
      const range: MotionRange = {
        start: { line: 0, col: 0 },
        end: { line: 0, col: 0 },
        linewise: true,
        inclusive: true,
      };
      executeOperatorOnRange(
        "<",
        range,
        buffer,
        { line: 0, col: 0 },
      );
      expect(buffer.getLine(0)).toBe("hello");
    });

    it("dedents multiple lines", () => {
      const buffer = new TextBuffer("  line1\n  line2\nline3");
      const range: MotionRange = {
        start: { line: 0, col: 0 },
        end: { line: 1, col: 0 },
        linewise: true,
        inclusive: true,
      };
      const result = executeOperatorOnRange(
        "<",
        range,
        buffer,
        { line: 0, col: 0 },
      );
      expect(buffer.getLine(0)).toBe("line1");
      expect(buffer.getLine(1)).toBe("line2");
      expect(result.statusMessage).toContain("2 lines");
    });
  });

  // ---------------------------------------------------
  // executeLineOperator with indent/dedent
  // ---------------------------------------------------
  describe("executeLineOperator - indent/dedent", () => {
    it("indents a line with >>", () => {
      const buffer = new TextBuffer("hello\nworld");
      const result = executeLineOperator(
        ">",
        { line: 0, col: 0 },
        1,
        buffer,
      );
      expect(buffer.getLine(0)).toBe("  hello");
      expect(result.newMode).toBe("normal");
    });

    it("dedents a line with <<", () => {
      const buffer = new TextBuffer("  hello\nworld");
      executeLineOperator(
        "<",
        { line: 0, col: 0 },
        1,
        buffer,
      );
      expect(buffer.getLine(0)).toBe("hello");
    });

    it("indents 2 lines with 2>>", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      executeLineOperator(
        ">",
        { line: 0, col: 0 },
        2,
        buffer,
      );
      expect(buffer.getLine(0)).toBe("  line1");
      expect(buffer.getLine(1)).toBe("  line2");
      expect(buffer.getLine(2)).toBe("line3");
    });
  });

  // ---------------------------------------------------
  // getTextInRange (tested indirectly via multi-line yank)
  // ---------------------------------------------------
  describe("Multi-line yank text extraction", () => {
    it("yanks text spanning 3 lines", () => {
      const buffer = new TextBuffer("aaa\nbbb\nccc\nddd");
      const range: MotionRange = {
        start: { line: 0, col: 1 },
        end: { line: 2, col: 2 },
        linewise: false,
        inclusive: true,
      };
      const result = executeOperatorOnRange(
        "y",
        range,
        buffer,
        { line: 0, col: 1 },
      );
      expect(result.yankedText).toBe("aa\nbbb\nccc");
      expect(buffer.getContent()).toBe("aaa\nbbb\nccc\nddd");
    });
  });
});
