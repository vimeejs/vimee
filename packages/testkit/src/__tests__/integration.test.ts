/**
 * integration.test.ts
 *
 * Validates testkit can express the same tests as the existing
 * core test suite. Tests representative patterns from normal-mode.test.ts.
 */
import { describe, it, expect } from "vitest";
import { vim } from "../index";

describe("testkit integration — normal mode patterns", () => {
  describe("count prefix", () => {
    it("moves 3 lines down with 3j", () => {
      const v = vim("line1\nline2\nline3\nline4\nline5");
      v.type("3j");
      expect(v.cursor()).toEqual({ line: 3, col: 0 });
    });

    it("correctly processes two-digit count like 10j", () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line${i}`).join("\n");
      const v = vim(lines);
      v.type("10j");
      expect(v.cursor().line).toBe(10);
    });
  });

  describe("motions", () => {
    it("w moves to next word", () => {
      const v = vim("hello world foo");
      v.type("w");
      expect(v.cursor().col).toBe(6);
    });

    it("$ moves to end of line", () => {
      const v = vim("hello");
      v.type("$");
      expect(v.cursor().col).toBe(4);
    });

    it("gg goes to first line", () => {
      const v = vim("line1\nline2\nline3", { cursor: [2, 0] });
      v.type("gg");
      expect(v.cursor().line).toBe(0);
    });

    it("G goes to last line", () => {
      const v = vim("line1\nline2\nline3");
      v.type("G");
      expect(v.cursor().line).toBe(2);
    });
  });

  describe("operators", () => {
    it("dd deletes current line", () => {
      const v = vim("hello\nworld\nfoo", { cursor: [1, 0] });
      v.type("dd");
      expect(v.content()).toBe("hello\nfoo");
    });

    it("yy + p yanks and pastes a line", () => {
      const v = vim("hello\nworld");
      v.type("yy");
      v.type("p");
      expect(v.content()).toBe("hello\nhello\nworld");
    });

    it("dw deletes a word", () => {
      const v = vim("hello world");
      v.type("dw");
      expect(v.content()).toBe("world");
    });

    it("ciw changes inner word", () => {
      const v = vim("hello world");
      v.type("ciw", "foo");
      expect(v.content()).toBe("foo world");
    });
  });

  describe("mode transitions", () => {
    it("i enters insert mode", () => {
      const v = vim("hello");
      v.type("i");
      expect(v.mode()).toBe("insert");
    });

    it("v enters visual mode", () => {
      const v = vim("hello");
      v.type("v");
      expect(v.mode()).toBe("visual");
    });

    it("V enters visual-line mode", () => {
      const v = vim("hello");
      v.type("V");
      expect(v.mode()).toBe("visual-line");
    });

    it(": enters command-line mode", () => {
      const v = vim("hello");
      v.type(":");
      expect(v.mode()).toBe("command-line");
    });
  });

  describe("insert mode with testkit", () => {
    it("types text in insert mode", () => {
      const v = vim("");
      v.type("i", "hello");
      expect(v.content()).toBe("hello");
      expect(v.mode()).toBe("normal");
    });

    it("A appends at end of line", () => {
      const v = vim("hello");
      v.type("A", " world");
      expect(v.content()).toBe("hello world");
    });

    it("o opens new line below", () => {
      const v = vim("hello\nworld");
      v.type("o", "foo");
      expect(v.content()).toBe("hello\nfoo\nworld");
    });
  });

  describe("undo/redo", () => {
    it("u undoes last change", () => {
      const v = vim("hello");
      v.type("dd");
      expect(v.content()).toBe("");
      v.type("u");
      expect(v.content()).toBe("hello");
    });

    it("<C-r> redoes after undo", () => {
      const v = vim("hello");
      v.type("dd");
      v.type("u");
      expect(v.content()).toBe("hello");
      v.type("<C-r>");
      expect(v.content()).toBe("");
    });
  });

  describe("registers", () => {
    it("dd stores deleted text in unnamed register", () => {
      const v = vim("hello\nworld");
      v.type("dd");
      expect(v.register('"')).toBe("hello\n");
    });

    it("yy stores yanked text in unnamed register", () => {
      const v = vim("hello\nworld");
      v.type("yy");
      expect(v.register('"')).toBe("hello\n");
    });
  });

  describe("search", () => {
    it("/ enters search mode", () => {
      const v = vim("hello world");
      v.type("/");
      expect(v.mode()).toBe("command-line");
    });
  });

  describe("visual mode operations", () => {
    it("visual select + d deletes selection", () => {
      const v = vim("hello world");
      v.type("vllld");
      expect(v.content()).toBe("o world");
    });
  });

  describe("raw() escape hatch", () => {
    it("allows direct access to VimContext fields", () => {
      const v = vim("hello");
      v.type("dd");
      const { ctx } = v.raw();
      expect(ctx.lastChange).toEqual(["d", "d"]);
    });
  });
});
