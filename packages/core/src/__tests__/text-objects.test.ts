import { describe, it, expect } from "vitest";
import { TextBuffer } from "../buffer";
import { resolveTextObject } from "../text-objects";

// Helper: create a TextBuffer from an array of lines
function buf(lines: string[]): TextBuffer {
  return new TextBuffer(lines.join("\n"));
}

// Helper: cursor position
function cur(line: number, col: number) {
  return { line, col };
}

describe("resolveTextObject", () => {
  // ---------------------------------------------------
  // iw / aw (inner/a word)
  // ---------------------------------------------------
  describe("iw (inner word)", () => {
    it("selects the word under cursor", () => {
      const b = buf(["hello world foo"]);
      const range = resolveTextObject("i", "w", cur(0, 7), b); // on 'o' of 'world'
      expect(range).not.toBeNull();
      expect(range!.start).toEqual(cur(0, 6));
      expect(range!.end).toEqual(cur(0, 10));
      expect(range!.inclusive).toBe(true);
      expect(range!.linewise).toBe(false);
    });

    it("selects word at start of line", () => {
      const b = buf(["hello world"]);
      const range = resolveTextObject("i", "w", cur(0, 2), b);
      expect(range!.start).toEqual(cur(0, 0));
      expect(range!.end).toEqual(cur(0, 4));
    });

    it("selects punctuation as a separate word", () => {
      const b = buf(["foo.bar"]);
      const range = resolveTextObject("i", "w", cur(0, 3), b); // on '.'
      expect(range!.start).toEqual(cur(0, 3));
      expect(range!.end).toEqual(cur(0, 3));
    });

    it("selects whitespace when cursor is on whitespace", () => {
      const b = buf(["hello   world"]);
      const range = resolveTextObject("i", "w", cur(0, 6), b); // on space
      expect(range!.start).toEqual(cur(0, 5));
      expect(range!.end).toEqual(cur(0, 7));
    });

    it("returns null on empty line", () => {
      const b = buf([""]);
      const range = resolveTextObject("i", "w", cur(0, 0), b);
      expect(range).toBeNull();
    });
  });

  describe("aw (a word)", () => {
    it("selects word with trailing whitespace", () => {
      const b = buf(["hello world foo"]);
      const range = resolveTextObject("a", "w", cur(0, 6), b); // on 'w' of 'world'
      expect(range!.start).toEqual(cur(0, 6));
      expect(range!.end).toEqual(cur(0, 11)); // includes trailing space
    });

    it("selects word with leading whitespace when at end of line", () => {
      const b = buf(["hello world"]);
      const range = resolveTextObject("a", "w", cur(0, 6), b); // on 'w' of 'world'
      // No trailing space, so includes leading space
      expect(range!.start).toEqual(cur(0, 5));
      expect(range!.end).toEqual(cur(0, 10));
    });

    it("selects first word without extra space", () => {
      const b = buf(["hello world"]);
      const range = resolveTextObject("a", "w", cur(0, 0), b);
      expect(range!.start).toEqual(cur(0, 0));
      expect(range!.end).toEqual(cur(0, 5)); // includes trailing space
    });

    it("returns null on empty line", () => {
      const b = buf([""]);
      const range = resolveTextObject("a", "w", cur(0, 0), b);
      expect(range).toBeNull();
    });
  });

  // ---------------------------------------------------
  // iW / aW (inner/a WORD)
  // ---------------------------------------------------
  describe("iW (inner WORD)", () => {
    it("selects WORD including punctuation", () => {
      const b = buf(["foo.bar baz"]);
      const range = resolveTextObject("i", "W", cur(0, 2), b); // on 'o' of 'foo.bar'
      expect(range!.start).toEqual(cur(0, 0));
      expect(range!.end).toEqual(cur(0, 6));
    });

    it("selects whitespace as WORD when on whitespace", () => {
      const b = buf(["hello   world"]);
      const range = resolveTextObject("i", "W", cur(0, 6), b);
      expect(range!.start).toEqual(cur(0, 5));
      expect(range!.end).toEqual(cur(0, 7));
    });

    it("returns null on empty line", () => {
      const b = buf([""]);
      const range = resolveTextObject("i", "W", cur(0, 0), b);
      expect(range).toBeNull();
    });
  });

  describe("aW (a WORD)", () => {
    it("selects WORD with trailing whitespace", () => {
      const b = buf(["foo.bar baz qux"]);
      const range = resolveTextObject("a", "W", cur(0, 2), b);
      expect(range!.start).toEqual(cur(0, 0));
      expect(range!.end).toEqual(cur(0, 7)); // includes trailing space
    });

    it("selects WORD with leading whitespace at end", () => {
      const b = buf(["hello foo.bar"]);
      const range = resolveTextObject("a", "W", cur(0, 8), b);
      expect(range!.start).toEqual(cur(0, 5));
      expect(range!.end).toEqual(cur(0, 12));
    });
  });

  // ---------------------------------------------------
  // i" / a" (inner/a double quotes)
  // ---------------------------------------------------
  describe('i" (inner double quotes)', () => {
    it("selects content inside double quotes", () => {
      const b = buf(['hello "world" foo']);
      const range = resolveTextObject("i", '"', cur(0, 8), b); // inside quotes
      expect(range!.start).toEqual(cur(0, 7));
      expect(range!.end).toEqual(cur(0, 11));
    });

    it("selects content when cursor is on opening quote", () => {
      const b = buf(['say "hello" end']);
      const range = resolveTextObject("i", '"', cur(0, 4), b); // on opening quote
      expect(range!.start).toEqual(cur(0, 5));
      expect(range!.end).toEqual(cur(0, 9));
    });

    it("selects content when cursor is on closing quote", () => {
      const b = buf(['say "hello" end']);
      const range = resolveTextObject("i", '"', cur(0, 10), b); // on closing quote
      expect(range!.start).toEqual(cur(0, 5));
      expect(range!.end).toEqual(cur(0, 9));
    });

    it("finds next quote pair when cursor is before quotes", () => {
      const b = buf(['say "hello" end']);
      const range = resolveTextObject("i", '"', cur(0, 0), b);
      expect(range).not.toBeNull();
      expect(range!.start).toEqual(cur(0, 5));
      expect(range!.end).toEqual(cur(0, 9));
    });

    it("returns null when no quotes found", () => {
      const b = buf(["hello world"]);
      const range = resolveTextObject("i", '"', cur(0, 3), b);
      expect(range).toBeNull();
    });

    it("returns null when only one quote exists", () => {
      const b = buf(['hello "world']);
      const range = resolveTextObject("i", '"', cur(0, 8), b);
      expect(range).toBeNull();
    });
  });

  describe('a" (a double quotes)', () => {
    it("selects content including quotes", () => {
      const b = buf(['say "hello" end']);
      const range = resolveTextObject("a", '"', cur(0, 6), b);
      expect(range!.start).toEqual(cur(0, 4));
      expect(range!.end).toEqual(cur(0, 10));
    });

    it("returns null when no quotes found", () => {
      const b = buf(["hello world"]);
      const range = resolveTextObject("a", '"', cur(0, 3), b);
      expect(range).toBeNull();
    });
  });

  // ---------------------------------------------------
  // i' / a' (single quotes)
  // ---------------------------------------------------
  describe("i' (inner single quotes)", () => {
    it("selects content inside single quotes", () => {
      const b = buf(["say 'hello' ok"]);
      const range = resolveTextObject("i", "'", cur(0, 6), b);
      expect(range!.start).toEqual(cur(0, 5));
      expect(range!.end).toEqual(cur(0, 9));
    });
  });

  describe("a' (a single quotes)", () => {
    it("selects content including single quotes", () => {
      const b = buf(["say 'hello' ok"]);
      const range = resolveTextObject("a", "'", cur(0, 6), b);
      expect(range!.start).toEqual(cur(0, 4));
      expect(range!.end).toEqual(cur(0, 10));
    });
  });

  // ---------------------------------------------------
  // i` / a` (backtick quotes)
  // ---------------------------------------------------
  describe("i` (inner backtick quotes)", () => {
    it("selects content inside backtick quotes", () => {
      const b = buf(["say `hello` ok"]);
      const range = resolveTextObject("i", "`", cur(0, 6), b);
      expect(range!.start).toEqual(cur(0, 5));
      expect(range!.end).toEqual(cur(0, 9));
    });
  });

  // ---------------------------------------------------
  // i( / a( (parentheses)
  // ---------------------------------------------------
  describe("i( / i) (inner parentheses)", () => {
    it("selects content inside parens", () => {
      const b = buf(["foo(bar, baz) end"]);
      const range = resolveTextObject("i", "(", cur(0, 5), b);
      expect(range!.start).toEqual(cur(0, 4));
      expect(range!.end).toEqual(cur(0, 11));
    });

    it("i) is an alias for i(", () => {
      const b = buf(["foo(bar) end"]);
      const range = resolveTextObject("i", ")", cur(0, 5), b);
      expect(range!.start).toEqual(cur(0, 4));
      expect(range!.end).toEqual(cur(0, 6));
    });

    it("works with nested parens", () => {
      const b = buf(["foo(bar(baz)) end"]);
      const range = resolveTextObject("i", "(", cur(0, 8), b); // inside inner parens
      expect(range!.start).toEqual(cur(0, 8));
      expect(range!.end).toEqual(cur(0, 10));
    });

    it("works across multiple lines", () => {
      const b = buf(["foo(", "  bar,", "  baz", ") end"]);
      const range = resolveTextObject("i", "(", cur(1, 3), b); // on 'bar'
      expect(range!.start).toEqual(cur(0, 4));
      expect(range!.end).toEqual(cur(3, -1)); // before the )
      // Actually let's check start line and end line
      expect(range!.start.line).toBe(0);
      expect(range!.end.line).toBe(3);
    });

    it("returns null when no matching pair", () => {
      const b = buf(["hello world"]);
      const range = resolveTextObject("i", "(", cur(0, 3), b);
      expect(range).toBeNull();
    });

    it("handles empty parens", () => {
      const b = buf(["foo() end"]);
      const range = resolveTextObject("i", "(", cur(0, 3), b); // on (
      // Adjacent brackets: start and end are same
      expect(range).not.toBeNull();
    });
  });

  describe("a( / a) (a parentheses)", () => {
    it("selects content including parens", () => {
      const b = buf(["foo(bar) end"]);
      const range = resolveTextObject("a", "(", cur(0, 5), b);
      expect(range!.start).toEqual(cur(0, 3));
      expect(range!.end).toEqual(cur(0, 7));
    });
  });

  // ---------------------------------------------------
  // i{ / a{ (braces)
  // ---------------------------------------------------
  describe("i{ / i} (inner braces)", () => {
    it("selects content inside braces", () => {
      const b = buf(["fn { body } end"]);
      const range = resolveTextObject("i", "{", cur(0, 6), b);
      expect(range!.start).toEqual(cur(0, 4));
      expect(range!.end).toEqual(cur(0, 9));
    });

    it("i} is an alias for i{", () => {
      const b = buf(["fn { x } end"]);
      const range = resolveTextObject("i", "}", cur(0, 5), b);
      expect(range!.start).toEqual(cur(0, 4));
      expect(range!.end).toEqual(cur(0, 6));
    });
  });

  describe("a{ / a} (a braces)", () => {
    it("selects content including braces", () => {
      const b = buf(["fn { body } end"]);
      const range = resolveTextObject("a", "{", cur(0, 6), b);
      expect(range!.start).toEqual(cur(0, 3));
      expect(range!.end).toEqual(cur(0, 10));
    });
  });

  // ---------------------------------------------------
  // i[ / a[ (brackets)
  // ---------------------------------------------------
  describe("i[ / i] (inner brackets)", () => {
    it("selects content inside brackets", () => {
      const b = buf(["arr[idx] end"]);
      const range = resolveTextObject("i", "[", cur(0, 5), b);
      expect(range!.start).toEqual(cur(0, 4));
      expect(range!.end).toEqual(cur(0, 6));
    });

    it("i] is an alias for i[", () => {
      const b = buf(["arr[idx] end"]);
      const range = resolveTextObject("i", "]", cur(0, 5), b);
      expect(range!.start).toEqual(cur(0, 4));
      expect(range!.end).toEqual(cur(0, 6));
    });
  });

  // ---------------------------------------------------
  // i< / a< (angle brackets)
  // ---------------------------------------------------
  describe("i< / i> (inner angle brackets)", () => {
    it("selects content inside angle brackets", () => {
      const b = buf(["<div> end"]);
      const range = resolveTextObject("i", "<", cur(0, 2), b);
      expect(range!.start).toEqual(cur(0, 1));
      expect(range!.end).toEqual(cur(0, 3));
    });

    it("i> is an alias for i<", () => {
      const b = buf(["<div> end"]);
      const range = resolveTextObject("i", ">", cur(0, 2), b);
      expect(range!.start).toEqual(cur(0, 1));
      expect(range!.end).toEqual(cur(0, 3));
    });
  });

  describe("a< / a> (a angle brackets)", () => {
    it("selects content including angle brackets", () => {
      const b = buf(["<div> end"]);
      const range = resolveTextObject("a", "<", cur(0, 2), b);
      expect(range!.start).toEqual(cur(0, 0));
      expect(range!.end).toEqual(cur(0, 4));
    });
  });

  // ---------------------------------------------------
  // Unknown key
  // ---------------------------------------------------
  describe("unknown key", () => {
    it("returns null for unknown text object key", () => {
      const b = buf(["hello"]);
      expect(resolveTextObject("i", "z", cur(0, 0), b)).toBeNull();
      expect(resolveTextObject("a", "z", cur(0, 0), b)).toBeNull();
    });
  });

  // ---------------------------------------------------
  // Edge cases
  // ---------------------------------------------------
  describe("edge cases", () => {
    it("cursor past end of line is clamped for iw", () => {
      const b = buf(["hello"]);
      const range = resolveTextObject("i", "w", cur(0, 100), b);
      expect(range).not.toBeNull();
      // Should clamp to last char
      expect(range!.start).toEqual(cur(0, 0));
      expect(range!.end).toEqual(cur(0, 4));
    });

    it("nested braces across lines", () => {
      const b = buf(["if {", "  for {", "    x", "  }", "}"]);
      const range = resolveTextObject("i", "{", cur(2, 3), b); // on 'x'
      expect(range).not.toBeNull();
      expect(range!.start.line).toBe(1);
      expect(range!.end.line).toBe(3);
    });

    it("cursor on opening bracket for i(", () => {
      const b = buf(["foo(bar)"]);
      const range = resolveTextObject("i", "(", cur(0, 3), b); // on (
      expect(range).not.toBeNull();
      expect(range!.start).toEqual(cur(0, 4));
      expect(range!.end).toEqual(cur(0, 6));
    });

    it("cursor on closing bracket searches backward for pair", () => {
      const b = buf(["foo(bar)"]);
      // When cursor is on ), findMatchingPair searches backward.
      // The ) at col 7 triggers backward search which finds ( at col 3.
      const range = resolveTextObject("i", ")", cur(0, 4), b); // inside parens
      expect(range).not.toBeNull();
      expect(range!.start).toEqual(cur(0, 4));
      expect(range!.end).toEqual(cur(0, 6));
    });
  });
});
