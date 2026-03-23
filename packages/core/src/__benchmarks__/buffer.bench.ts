import { bench, describe } from "vitest";
import { TextBuffer } from "../buffer";

// =====================
// Document generators (in-memory, no files on disk)
// =====================

const SMALL_DOC = Array.from({ length: 20 }, (_, i) => `Line ${i}: some sample text here`).join(
  "\n",
);

const LARGE_DOC = Array.from(
  { length: 1000 },
  (_, i) => `Line ${i}: ${"lorem ipsum dolor sit amet ".repeat(3)}`,
).join("\n");

const HUGE_DOC_100K = Array.from(
  { length: 100_000 },
  (_, i) => `Line ${i}: ${"lorem ipsum dolor sit amet ".repeat(3)}`,
).join("\n");

const HUGE_DOC_1M = Array.from(
  { length: 1_000_000 },
  (_, i) => `Line ${i}: ${"x".repeat(80)}`,
).join("\n");

// =====================
// Construction
// =====================

describe("TextBuffer - construction", () => {
  bench("create from small document (20 lines)", () => {
    new TextBuffer(SMALL_DOC);
  });

  bench("create from large document (1K lines)", () => {
    new TextBuffer(LARGE_DOC);
  });

  bench("create from huge document (100K lines)", () => {
    new TextBuffer(HUGE_DOC_100K);
  });

  bench("create from huge document (1M lines)", () => {
    new TextBuffer(HUGE_DOC_1M);
  });
});

// =====================
// Read operations
// =====================

describe("TextBuffer - read operations (1K lines)", () => {
  const buffer = new TextBuffer(LARGE_DOC);

  bench("getLine (middle)", () => {
    buffer.getLine(500);
  });

  bench("getLineCount", () => {
    buffer.getLineCount();
  });

  bench("getContent", () => {
    buffer.getContent();
  });
});

describe("TextBuffer - read operations (100K lines)", () => {
  const buffer = new TextBuffer(HUGE_DOC_100K);

  bench("getLine (middle)", () => {
    buffer.getLine(50_000);
  });

  bench("getLineCount", () => {
    buffer.getLineCount();
  });

  bench("getContent", () => {
    buffer.getContent();
  });
});

describe("TextBuffer - read operations (1M lines)", () => {
  const buffer = new TextBuffer(HUGE_DOC_1M);

  bench("getLine (middle)", () => {
    buffer.getLine(500_000);
  });

  bench("getLineCount", () => {
    buffer.getLineCount();
  });

  bench("getContent", () => {
    buffer.getContent();
  });
});

// =====================
// Mutations — small document
// =====================

describe("TextBuffer - mutations (20 lines)", () => {
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

// =====================
// Mutations — large documents (Piece Table vs string[] differentiator)
// =====================

describe("TextBuffer - mutations (100K lines)", () => {
  bench("insertLine at middle", () => {
    const buffer = new TextBuffer(HUGE_DOC_100K);
    buffer.insertLine(50_000, "new line inserted in the middle");
  });

  bench("deleteLines at middle (1 line)", () => {
    const buffer = new TextBuffer(HUGE_DOC_100K);
    buffer.deleteLines(50_000, 1);
  });

  bench("splitLine at middle", () => {
    const buffer = new TextBuffer(HUGE_DOC_100K);
    buffer.splitLine(50_000, 40);
  });

  bench("joinLines at middle", () => {
    const buffer = new TextBuffer(HUGE_DOC_100K);
    buffer.joinLines(50_000);
  });

  bench("setLine at middle", () => {
    const buffer = new TextBuffer(HUGE_DOC_100K);
    buffer.setLine(50_000, "completely replaced line content");
  });
});

describe("TextBuffer - mutations (1M lines)", () => {
  bench("insertLine at middle", () => {
    const buffer = new TextBuffer(HUGE_DOC_1M);
    buffer.insertLine(500_000, "new line inserted in the middle");
  });

  bench("deleteLines at middle (1 line)", () => {
    const buffer = new TextBuffer(HUGE_DOC_1M);
    buffer.deleteLines(500_000, 1);
  });

  bench("splitLine at middle", () => {
    const buffer = new TextBuffer(HUGE_DOC_1M);
    buffer.splitLine(500_000, 40);
  });

  bench("joinLines at middle", () => {
    const buffer = new TextBuffer(HUGE_DOC_1M);
    buffer.joinLines(500_000);
  });

  bench("setLine at middle", () => {
    const buffer = new TextBuffer(HUGE_DOC_1M);
    buffer.setLine(500_000, "completely replaced line content");
  });
});

// =====================
// Undo/Redo — the biggest Piece Table win
// =====================

describe("TextBuffer - undo/redo (20 lines)", () => {
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

describe("TextBuffer - undo/redo (100K lines)", () => {
  bench("saveUndoPoint + edit", () => {
    const buffer = new TextBuffer(HUGE_DOC_100K);
    const cursor = { line: 50_000, col: 0 };
    buffer.saveUndoPoint(cursor);
    buffer.insertAt(50_000, 0, "change");
  });

  bench("saveUndoPoint + edit + undo", () => {
    const buffer = new TextBuffer(HUGE_DOC_100K);
    const cursor = { line: 50_000, col: 0 };
    buffer.saveUndoPoint(cursor);
    buffer.insertAt(50_000, 0, "change");
    buffer.undo(cursor);
  });
});

describe("TextBuffer - undo/redo (1M lines)", () => {
  bench("saveUndoPoint + edit", () => {
    const buffer = new TextBuffer(HUGE_DOC_1M);
    const cursor = { line: 500_000, col: 0 };
    buffer.saveUndoPoint(cursor);
    buffer.insertAt(500_000, 0, "change");
  });

  bench("saveUndoPoint + edit + undo", () => {
    const buffer = new TextBuffer(HUGE_DOC_1M);
    const cursor = { line: 500_000, col: 0 };
    buffer.saveUndoPoint(cursor);
    buffer.insertAt(500_000, 0, "change");
    buffer.undo(cursor);
  });
});

// =====================
// Realistic editing pattern
// =====================

describe("TextBuffer - realistic editing (100K lines)", () => {
  bench("10 sequential edits near cursor", () => {
    const buffer = new TextBuffer(HUGE_DOC_100K);
    const cursor = { line: 50_000, col: 0 };
    for (let i = 0; i < 10; i++) {
      buffer.saveUndoPoint(cursor);
      buffer.insertAt(50_000, 0, `edit${i} `);
    }
  });
});

describe("TextBuffer - realistic editing (1M lines)", () => {
  bench("10 sequential edits near cursor", () => {
    const buffer = new TextBuffer(HUGE_DOC_1M);
    const cursor = { line: 500_000, col: 0 };
    for (let i = 0; i < 10; i++) {
      buffer.saveUndoPoint(cursor);
      buffer.insertAt(500_000, 0, `edit${i} `);
    }
  });
});
