import { bench, describe } from "vitest";
import { TextBuffer } from "../buffer";

const SMALL_DOC = Array.from({ length: 20 }, (_, i) => `Line ${i}: some sample text here`).join(
  "\n",
);

const LARGE_DOC = Array.from(
  { length: 1000 },
  (_, i) => `Line ${i}: ${"lorem ipsum dolor sit amet ".repeat(3)}`,
).join("\n");

describe("TextBuffer - construction", () => {
  bench("create from small document (20 lines)", () => {
    new TextBuffer(SMALL_DOC);
  });

  bench("create from large document (1000 lines)", () => {
    new TextBuffer(LARGE_DOC);
  });
});

describe("TextBuffer - read operations", () => {
  const buffer = new TextBuffer(LARGE_DOC);

  bench("getLine", () => {
    buffer.getLine(500);
  });

  bench("getLineCount", () => {
    buffer.getLineCount();
  });

  bench("getContent", () => {
    buffer.getContent();
  });
});

describe("TextBuffer - mutations", () => {
  bench("insertAt", () => {
    const buffer = new TextBuffer(SMALL_DOC);
    buffer.insertAt(10, 5, "inserted text");
  });

  bench("deleteAt", () => {
    const buffer = new TextBuffer(SMALL_DOC);
    buffer.deleteAt(10, 5, 5);
  });

  bench("deleteRange (single line)", () => {
    const buffer = new TextBuffer(SMALL_DOC);
    buffer.deleteRange(5, 2, 5, 10);
  });

  bench("deleteRange (multi-line)", () => {
    const buffer = new TextBuffer(SMALL_DOC);
    buffer.deleteRange(2, 5, 8, 10);
  });

  bench("splitLine", () => {
    const buffer = new TextBuffer(SMALL_DOC);
    buffer.splitLine(10, 5);
  });

  bench("joinLines", () => {
    const buffer = new TextBuffer(SMALL_DOC);
    buffer.joinLines(10);
  });
});

describe("TextBuffer - undo/redo", () => {
  bench("saveUndoPoint + undo", () => {
    const buffer = new TextBuffer(SMALL_DOC);
    const cursor = { line: 0, col: 0 };
    buffer.saveUndoPoint(cursor);
    buffer.insertAt(0, 0, "change");
    buffer.undo(cursor);
  });

  bench("undo + redo cycle", () => {
    const buffer = new TextBuffer(SMALL_DOC);
    const cursor = { line: 0, col: 0 };
    buffer.saveUndoPoint(cursor);
    buffer.insertAt(0, 0, "change");
    buffer.undo(cursor);
    buffer.redo(cursor);
  });
});
