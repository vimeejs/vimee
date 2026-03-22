/**
 * search.test.ts
 *
 * Tests for buffer search functionality.
 * Verifies forward search, backward search, wrap-around, and regex error handling.
 */

import { describe, it, expect } from "vitest";
import { searchInBuffer } from "../search";
import { TextBuffer } from "../buffer";

// =====================
// Tests
// =====================

describe("Search functionality", () => {
  // ---------------------------------------------------
  // Forward search
  // ---------------------------------------------------
  describe("Forward search", () => {
    it("finds the first match after the cursor position", () => {
      const buffer = new TextBuffer("hello world hello");
      const result = searchInBuffer(
        buffer,
        "hello",
        { line: 0, col: 0 },
        "forward",
      );
      expect(result).toEqual({ line: 0, col: 12 });
    });

    it("finds a match on the next line", () => {
      const buffer = new TextBuffer("foo\nbar\nbaz");
      const result = searchInBuffer(
        buffer,
        "baz",
        { line: 0, col: 0 },
        "forward",
      );
      expect(result).toEqual({ line: 2, col: 0 });
    });

    it("wraps around to find a match from the beginning", () => {
      const buffer = new TextBuffer("hello\nworld\nfoo");
      const result = searchInBuffer(
        buffer,
        "hello",
        { line: 1, col: 0 },
        "forward",
      );
      expect(result).toEqual({ line: 0, col: 0 });
    });

    it("finds a match after the cursor on the same line", () => {
      const buffer = new TextBuffer("foo bar foo");
      const result = searchInBuffer(
        buffer,
        "foo",
        { line: 0, col: 0 },
        "forward",
      );
      expect(result).toEqual({ line: 0, col: 8 });
    });
  });

  // ---------------------------------------------------
  // Backward search
  // ---------------------------------------------------
  describe("Backward search", () => {
    it("finds the closest match before the cursor position", () => {
      const buffer = new TextBuffer("hello world hello");
      const result = searchInBuffer(
        buffer,
        "hello",
        { line: 0, col: 12 },
        "backward",
      );
      expect(result).toEqual({ line: 0, col: 0 });
    });

    it("finds a match on a previous line", () => {
      const buffer = new TextBuffer("foo\nbar\nbaz");
      const result = searchInBuffer(
        buffer,
        "foo",
        { line: 2, col: 0 },
        "backward",
      );
      expect(result).toEqual({ line: 0, col: 0 });
    });

    it("wraps around to find a match from the end", () => {
      const buffer = new TextBuffer("foo\nbar\nhello");
      const result = searchInBuffer(
        buffer,
        "hello",
        { line: 0, col: 0 },
        "backward",
      );
      expect(result).toEqual({ line: 2, col: 0 });
    });
  });

  // ---------------------------------------------------
  // No match
  // ---------------------------------------------------
  describe("No match", () => {
    it("returns null when the pattern is not found", () => {
      const buffer = new TextBuffer("hello world");
      const result = searchInBuffer(
        buffer,
        "xyz",
        { line: 0, col: 0 },
        "forward",
      );
      expect(result).toBeNull();
    });

    it("returns null for backward search when no match is found", () => {
      const buffer = new TextBuffer("hello world");
      const result = searchInBuffer(
        buffer,
        "xyz",
        { line: 0, col: 10 },
        "backward",
      );
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------
  // Invalid regex
  // ---------------------------------------------------
  describe("Invalid regex", () => {
    it("returns null for an invalid regex pattern", () => {
      const buffer = new TextBuffer("hello world");
      const result = searchInBuffer(
        buffer,
        "[invalid",
        { line: 0, col: 0 },
        "forward",
      );
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------
  // Multiple matches on the same line
  // ---------------------------------------------------
  describe("Multiple matches on the same line", () => {
    it("returns the first match on the same line for forward search", () => {
      const buffer = new TextBuffer("aaa bbb aaa bbb aaa");
      const result = searchInBuffer(
        buffer,
        "bbb",
        { line: 0, col: 0 },
        "forward",
      );
      expect(result).toEqual({ line: 0, col: 4 });
    });

    it("returns the closest match to the cursor on the same line for backward search", () => {
      const buffer = new TextBuffer("aaa bbb aaa bbb aaa");
      const result = searchInBuffer(
        buffer,
        "bbb",
        { line: 0, col: 15 },
        "backward",
      );
      expect(result).toEqual({ line: 0, col: 12 });
    });
  });

  // ---------------------------------------------------
  // Regex patterns
  // ---------------------------------------------------
  describe("Regex patterns", () => {
    it("matches using a regex pattern", () => {
      const buffer = new TextBuffer("abc 123 def 456");
      const result = searchInBuffer(
        buffer,
        "\\d+",
        { line: 0, col: 0 },
        "forward",
      );
      expect(result).toEqual({ line: 0, col: 4 });
    });

    it("regex works across multiple lines", () => {
      const buffer = new TextBuffer("foo\nbar123\nbaz");
      const result = searchInBuffer(
        buffer,
        "\\d+",
        { line: 0, col: 0 },
        "forward",
      );
      expect(result).toEqual({ line: 1, col: 3 });
    });
  });

  // ---------------------------------------------------
  // Branch coverage: m.index ?? 0 fallback (lines 94, 100)
  //
  // The `?? 0` fallback for `m.index` in searchBackward is a TypeScript
  // defensive pattern. In practice, `RegExpMatchArray.index` is always
  // defined when the match comes from `String.prototype.matchAll()`,
  // so the nullish coalescing fallback branch (`?? 0` returning 0
  // instead of `m.index`) is never actually taken at runtime.
  // These branches are inherently uncoverable in V8 branch coverage.
  //
  // The tests below exercise the backward search paths that use these
  // lines, confirming the `m.index` value is always present and correct.
  // ---------------------------------------------------
  describe("Backward search m.index coverage", () => {
    it("backward search filter uses m.index on the cursor line (line 94)", () => {
      const buffer = new TextBuffer("aaa bbb ccc");
      // Cursor at col 8, backward search for "bbb" should find it at col 4
      const result = searchInBuffer(buffer, "bbb", { line: 0, col: 8 }, "backward");
      expect(result).toEqual({ line: 0, col: 4 });
    });

    it("backward search returns last.index for matches on non-cursor lines (line 100)", () => {
      const buffer = new TextBuffer("foo bar\nbaz qux");
      // Cursor on line 1, backward search for "bar" wraps to line 0
      const result = searchInBuffer(buffer, "bar", { line: 1, col: 0 }, "backward");
      expect(result).toEqual({ line: 0, col: 4 });
    });

    it("backward search with multiple matches returns closest before cursor", () => {
      const buffer = new TextBuffer("aa bb aa bb aa");
      // Cursor at col 12, backward search for "bb" should return col 9
      const result = searchInBuffer(buffer, "bb", { line: 0, col: 12 }, "backward");
      expect(result).toEqual({ line: 0, col: 9 });
    });
  });
});
