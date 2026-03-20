import { describe, it, expect } from "vitest";
import { TextBuffer } from "../buffer";

// Helper: concisely create a CursorPosition
const cursor = (line: number, col: number) => ({ line, col });

describe("TextBuffer", () => {
  // ============================================================
  // constructor
  // ============================================================
  describe("constructor", () => {
    it("should split content into lines by newlines", () => {
      const buf = new TextBuffer("hello\nworld\nfoo");
      expect(buf.getLineCount()).toBe(3);
      expect(buf.getLine(0)).toBe("hello");
      expect(buf.getLine(1)).toBe("world");
      expect(buf.getLine(2)).toBe("foo");
    });

    it("should result in a single empty line for an empty string", () => {
      const buf = new TextBuffer("");
      expect(buf.getLineCount()).toBe(1);
      expect(buf.getLine(0)).toBe("");
    });

    it("should add a trailing empty line when content ends with a newline", () => {
      const buf = new TextBuffer("hello\n");
      expect(buf.getLineCount()).toBe(2);
      expect(buf.getLine(0)).toBe("hello");
      expect(buf.getLine(1)).toBe("");
    });
  });

  // ============================================================
  // getLine
  // ============================================================
  describe("getLine", () => {
    it("should return the correct line for a valid index", () => {
      const buf = new TextBuffer("aaa\nbbb\nccc");
      expect(buf.getLine(1)).toBe("bbb");
    });

    it("should return an empty string for an out-of-range index", () => {
      const buf = new TextBuffer("only");
      expect(buf.getLine(999)).toBe("");
      expect(buf.getLine(-1)).toBe("");
    });
  });

  // ============================================================
  // getLineLength
  // ============================================================
  describe("getLineLength", () => {
    it("should return the character count of the line", () => {
      const buf = new TextBuffer("hello\nworld");
      expect(buf.getLineLength(0)).toBe(5);
      expect(buf.getLineLength(1)).toBe(5);
    });

    it("should return 0 for an empty line", () => {
      const buf = new TextBuffer("hello\n\nworld");
      expect(buf.getLineLength(1)).toBe(0);
    });

    it("should return 0 for an out-of-range index", () => {
      const buf = new TextBuffer("hello");
      expect(buf.getLineLength(100)).toBe(0);
    });
  });

  // ============================================================
  // getLineCount
  // ============================================================
  describe("getLineCount", () => {
    it("should return 1 for single-line content", () => {
      const buf = new TextBuffer("single line");
      expect(buf.getLineCount()).toBe(1);
    });

    it("should return the correct line count for multi-line content", () => {
      const buf = new TextBuffer("a\nb\nc\nd");
      expect(buf.getLineCount()).toBe(4);
    });

    it("should return 1 for an empty string", () => {
      const buf = new TextBuffer("");
      expect(buf.getLineCount()).toBe(1);
    });
  });

  // ============================================================
  // getContent
  // ============================================================
  describe("getContent", () => {
    it("should match the original content (round-trip)", () => {
      const original = "hello\nworld\nfoo bar";
      const buf = new TextBuffer(original);
      expect(buf.getContent()).toBe(original);
    });

    it("should round-trip correctly for an empty string", () => {
      const buf = new TextBuffer("");
      expect(buf.getContent()).toBe("");
    });

    it("should round-trip correctly for content with a trailing newline", () => {
      const original = "line1\nline2\n";
      const buf = new TextBuffer(original);
      expect(buf.getContent()).toBe(original);
    });
  });

  // ============================================================
  // getLines
  // ============================================================
  describe("getLines", () => {
    it("should return a read-only array of lines", () => {
      const buf = new TextBuffer("a\nb\nc");
      const lines = buf.getLines();
      expect(lines).toEqual(["a", "b", "c"]);
      expect(Array.isArray(lines)).toBe(true);
    });
  });

  // ============================================================
  // saveUndoPoint / undo
  // ============================================================
  describe("saveUndoPoint and undo", () => {
    it("should restore the previous state and cursor position on undo", () => {
      const buf = new TextBuffer("original");
      const savedCursor = cursor(0, 3);
      buf.saveUndoPoint(savedCursor);

      buf.setLine(0, "modified");
      expect(buf.getContent()).toBe("modified");

      const restoredCursor = buf.undo(cursor(0, 5));
      expect(restoredCursor).toEqual(savedCursor);
      expect(buf.getContent()).toBe("original");
    });

    it("should restore in LIFO order across multiple undos", () => {
      const buf = new TextBuffer("state0");

      buf.saveUndoPoint(cursor(0, 0));
      buf.setLine(0, "state1");

      buf.saveUndoPoint(cursor(0, 1));
      buf.setLine(0, "state2");

      const c1 = buf.undo(cursor(0, 2));
      expect(c1).toEqual(cursor(0, 1));
      expect(buf.getContent()).toBe("state1");

      const c0 = buf.undo(cursor(0, 1));
      expect(c0).toEqual(cursor(0, 0));
      expect(buf.getContent()).toBe("state0");
    });

    it("should return null when undoing with an empty stack", () => {
      const buf = new TextBuffer("hello");
      const result = buf.undo(cursor(0, 0));
      expect(result).toBeNull();
    });

    it("should not change content after undo when the stack is empty", () => {
      const buf = new TextBuffer("unchanged");
      buf.undo(cursor(0, 0));
      expect(buf.getContent()).toBe("unchanged");
    });
  });

  // ============================================================
  // redo
  // ============================================================
  describe("redo", () => {
    it("should restore the original state after undo then redo", () => {
      const buf = new TextBuffer("original");
      buf.saveUndoPoint(cursor(0, 0));
      buf.setLine(0, "changed");

      buf.undo(cursor(0, 4));
      expect(buf.getContent()).toBe("original");

      const redoCursor = buf.redo(cursor(0, 0));
      expect(redoCursor).toEqual(cursor(0, 4));
      expect(buf.getContent()).toBe("changed");
    });

    it("should clear the redo stack after a new change", () => {
      const buf = new TextBuffer("v1");
      buf.saveUndoPoint(cursor(0, 0));
      buf.setLine(0, "v2");

      buf.undo(cursor(0, 1));
      expect(buf.getContent()).toBe("v1");

      buf.saveUndoPoint(cursor(0, 0));
      buf.setLine(0, "v3");

      const result = buf.redo(cursor(0, 0));
      expect(result).toBeNull();
    });

    it("should return null when redoing with an empty redo stack", () => {
      const buf = new TextBuffer("hello");
      const result = buf.redo(cursor(0, 0));
      expect(result).toBeNull();
    });
  });

  // ============================================================
  // setLine
  // ============================================================
  describe("setLine", () => {
    it("should update the content of the specified line", () => {
      const buf = new TextBuffer("aaa\nbbb\nccc");
      buf.setLine(1, "BBB");
      expect(buf.getLine(1)).toBe("BBB");
      expect(buf.getLine(0)).toBe("aaa");
      expect(buf.getLine(2)).toBe("ccc");
    });

    it("should not change anything for an out-of-range index", () => {
      const buf = new TextBuffer("hello");
      buf.setLine(5, "no effect");
      expect(buf.getContent()).toBe("hello");
    });

    it("should not change anything for a negative index", () => {
      const buf = new TextBuffer("hello");
      buf.setLine(-1, "no effect");
      expect(buf.getContent()).toBe("hello");
    });
  });

  // ============================================================
  // insertAt
  // ============================================================
  describe("insertAt", () => {
    it("should insert text at the beginning of a line", () => {
      const buf = new TextBuffer("world");
      buf.insertAt(0, 0, "hello ");
      expect(buf.getLine(0)).toBe("hello world");
    });

    it("should insert text in the middle of a line", () => {
      const buf = new TextBuffer("helo");
      buf.insertAt(0, 2, "l");
      expect(buf.getLine(0)).toBe("hello");
    });

    it("should insert text at the end of a line", () => {
      const buf = new TextBuffer("hello");
      buf.insertAt(0, 5, " world");
      expect(buf.getLine(0)).toBe("hello world");
    });

    it("should insert multiple characters at once", () => {
      const buf = new TextBuffer("ac");
      buf.insertAt(0, 1, "b");
      expect(buf.getLine(0)).toBe("abc");
    });
  });

  // ============================================================
  // deleteAt
  // ============================================================
  describe("deleteAt", () => {
    it("should delete and return a single character", () => {
      const buf = new TextBuffer("hello");
      const deleted = buf.deleteAt(0, 1);
      expect(deleted).toBe("e");
      expect(buf.getLine(0)).toBe("hllo");
    });

    it("should delete and return multiple characters", () => {
      const buf = new TextBuffer("abcdef");
      const deleted = buf.deleteAt(0, 1, 3);
      expect(deleted).toBe("bcd");
      expect(buf.getLine(0)).toBe("aef");
    });

    it("should delete up to the end of the line when count exceeds line length", () => {
      const buf = new TextBuffer("abc");
      const deleted = buf.deleteAt(0, 1, 100);
      expect(deleted).toBe("bc");
      expect(buf.getLine(0)).toBe("a");
    });

    it("should delete from the beginning of the line", () => {
      const buf = new TextBuffer("hello");
      const deleted = buf.deleteAt(0, 0, 2);
      expect(deleted).toBe("he");
      expect(buf.getLine(0)).toBe("llo");
    });
  });

  // ============================================================
  // deleteRange
  // ============================================================
  describe("deleteRange", () => {
    it("should delete a range within the same line", () => {
      const buf = new TextBuffer("hello world");
      const deleted = buf.deleteRange(0, 5, 0, 11);
      expect(deleted).toBe(" world");
      expect(buf.getLine(0)).toBe("hello");
    });

    it("should delete a range spanning multiple lines", () => {
      const buf = new TextBuffer("aaa\nbbb\nccc\nddd");
      const deleted = buf.deleteRange(0, 2, 2, 1);
      expect(deleted).toBe("a\nbbb\nc");
      expect(buf.getLineCount()).toBe(2);
      expect(buf.getLine(0)).toBe("aacc");
      expect(buf.getLine(1)).toBe("ddd");
    });

    it("should delete from start to end within the same line", () => {
      const buf = new TextBuffer("delete me\nkeep");
      const deleted = buf.deleteRange(0, 0, 0, 9);
      expect(deleted).toBe("delete me");
      expect(buf.getLine(0)).toBe("");
    });

    it("should merge lines when deleting across two lines", () => {
      const buf = new TextBuffer("first\nsecond\nthird");
      const deleted = buf.deleteRange(0, 3, 1, 3);
      expect(deleted).toBe("st\nsec");
      expect(buf.getLine(0)).toBe("firond");
      expect(buf.getLineCount()).toBe(2);
    });
  });

  // ============================================================
  // deleteLines
  // ============================================================
  describe("deleteLines", () => {
    it("should delete a single line", () => {
      const buf = new TextBuffer("aaa\nbbb\nccc");
      const deleted = buf.deleteLines(1, 1);
      expect(deleted).toEqual(["bbb"]);
      expect(buf.getLineCount()).toBe(2);
      expect(buf.getLine(0)).toBe("aaa");
      expect(buf.getLine(1)).toBe("ccc");
    });

    it("should delete multiple lines", () => {
      const buf = new TextBuffer("a\nb\nc\nd\ne");
      const deleted = buf.deleteLines(1, 3);
      expect(deleted).toEqual(["b", "c", "d"]);
      expect(buf.getLineCount()).toBe(2);
      expect(buf.getLine(0)).toBe("a");
      expect(buf.getLine(1)).toBe("e");
    });

    it("should only delete existing lines when count exceeds remaining lines", () => {
      const buf = new TextBuffer("x\ny\nz");
      const deleted = buf.deleteLines(1, 100);
      expect(deleted).toEqual(["y", "z"]);
      expect(buf.getLineCount()).toBe(1);
      expect(buf.getLine(0)).toBe("x");
    });

    it("should delete the first line", () => {
      const buf = new TextBuffer("first\nsecond");
      const deleted = buf.deleteLines(0, 1);
      expect(deleted).toEqual(["first"]);
      expect(buf.getLineCount()).toBe(1);
      expect(buf.getLine(0)).toBe("second");
    });
  });

  // ============================================================
  // insertLine
  // ============================================================
  describe("insertLine", () => {
    it("should insert a line at the beginning", () => {
      const buf = new TextBuffer("existing");
      buf.insertLine(0, "new first");
      expect(buf.getLineCount()).toBe(2);
      expect(buf.getLine(0)).toBe("new first");
      expect(buf.getLine(1)).toBe("existing");
    });

    it("should insert a line in the middle", () => {
      const buf = new TextBuffer("a\nc");
      buf.insertLine(1, "b");
      expect(buf.getLineCount()).toBe(3);
      expect(buf.getLine(0)).toBe("a");
      expect(buf.getLine(1)).toBe("b");
      expect(buf.getLine(2)).toBe("c");
    });

    it("should insert a line at the end", () => {
      const buf = new TextBuffer("first");
      buf.insertLine(1, "second");
      expect(buf.getLineCount()).toBe(2);
      expect(buf.getLine(0)).toBe("first");
      expect(buf.getLine(1)).toBe("second");
    });
  });

  // ============================================================
  // splitLine
  // ============================================================
  describe("splitLine", () => {
    it("should insert an empty line before when splitting at the beginning of a line", () => {
      const buf = new TextBuffer("hello");
      buf.splitLine(0, 0);
      expect(buf.getLineCount()).toBe(2);
      expect(buf.getLine(0)).toBe("");
      expect(buf.getLine(1)).toBe("hello");
    });

    it("should split in the middle of a line", () => {
      const buf = new TextBuffer("hello world");
      buf.splitLine(0, 5);
      expect(buf.getLineCount()).toBe(2);
      expect(buf.getLine(0)).toBe("hello");
      expect(buf.getLine(1)).toBe(" world");
    });

    it("should insert an empty line after when splitting at the end of a line", () => {
      const buf = new TextBuffer("hello");
      buf.splitLine(0, 5);
      expect(buf.getLineCount()).toBe(2);
      expect(buf.getLine(0)).toBe("hello");
      expect(buf.getLine(1)).toBe("");
    });

    it("should split a middle line in a multi-line buffer", () => {
      const buf = new TextBuffer("aa\nbbcc\ndd");
      buf.splitLine(1, 2);
      expect(buf.getLineCount()).toBe(4);
      expect(buf.getLine(0)).toBe("aa");
      expect(buf.getLine(1)).toBe("bb");
      expect(buf.getLine(2)).toBe("cc");
      expect(buf.getLine(3)).toBe("dd");
    });
  });

  // ============================================================
  // joinLines
  // ============================================================
  describe("joinLines", () => {
    it("should join with the next line", () => {
      const buf = new TextBuffer("hello\nworld");
      buf.joinLines(0);
      expect(buf.getLineCount()).toBe(1);
      expect(buf.getLine(0)).toBe("helloworld");
    });

    it("should do nothing when calling joinLines on the last line", () => {
      const buf = new TextBuffer("only line");
      buf.joinLines(0);
      expect(buf.getLineCount()).toBe(1);
      expect(buf.getLine(0)).toBe("only line");
    });

    it("should join a middle line", () => {
      const buf = new TextBuffer("a\nb\nc");
      buf.joinLines(1);
      expect(buf.getLineCount()).toBe(2);
      expect(buf.getLine(0)).toBe("a");
      expect(buf.getLine(1)).toBe("bc");
    });

    it("should correctly join with an empty line", () => {
      const buf = new TextBuffer("hello\n\nworld");
      buf.joinLines(0);
      expect(buf.getLineCount()).toBe(2);
      expect(buf.getLine(0)).toBe("hello");
      expect(buf.getLine(1)).toBe("world");
    });
  });

  // ============================================================
  // replaceContent
  // ============================================================
  describe("replaceContent", () => {
    it("should replace the entire content", () => {
      const buf = new TextBuffer("old content\nmultiple lines");
      buf.replaceContent("new\ncontent");
      expect(buf.getLineCount()).toBe(2);
      expect(buf.getLine(0)).toBe("new");
      expect(buf.getLine(1)).toBe("content");
    });

    it("should replace with an empty string", () => {
      const buf = new TextBuffer("something");
      buf.replaceContent("");
      expect(buf.getLineCount()).toBe(1);
      expect(buf.getLine(0)).toBe("");
    });

    it("should return the new content from getContent after replacement", () => {
      const buf = new TextBuffer("before");
      const newContent = "after\nreplacement";
      buf.replaceContent(newContent);
      expect(buf.getContent()).toBe(newContent);
    });
  });

  // ============================================================
  // undo / redo integration tests
  // ============================================================
  describe("undo/redo integration tests", () => {
    it("should work correctly for consecutive undo -> redo -> undo operations", () => {
      const buf = new TextBuffer("v0");
      buf.saveUndoPoint(cursor(0, 0));
      buf.setLine(0, "v1");
      buf.saveUndoPoint(cursor(0, 1));
      buf.setLine(0, "v2");

      buf.undo(cursor(0, 2));
      expect(buf.getContent()).toBe("v1");

      buf.redo(cursor(0, 1));
      expect(buf.getContent()).toBe("v2");

      buf.undo(cursor(0, 2));
      expect(buf.getContent()).toBe("v1");

      buf.undo(cursor(0, 1));
      expect(buf.getContent()).toBe("v0");
    });

    it("should save a copy of the cursor position in saveUndoPoint (not a reference)", () => {
      const buf = new TextBuffer("test");
      const mutableCursor = { line: 0, col: 5 };
      buf.saveUndoPoint(mutableCursor);

      mutableCursor.line = 99;
      mutableCursor.col = 99;

      buf.setLine(0, "modified");
      const restored = buf.undo(cursor(0, 0));
      expect(restored).toEqual(cursor(0, 5));
    });

    it("should correctly save the current state to the redo stack on undo", () => {
      const buf = new TextBuffer("original");
      buf.saveUndoPoint(cursor(0, 0));
      buf.setLine(0, "edited");

      const undoCursor = cursor(0, 6);
      buf.undo(undoCursor);

      const redoResult = buf.redo(cursor(0, 0));
      expect(redoResult).toEqual(undoCursor);
      expect(buf.getContent()).toBe("edited");
    });
  });
});
