import { describe, it, expect } from "vitest";
import { cursorToMonacoPosition, monacoPositionToCursor } from "../cursor";

describe("cursorToMonacoPosition", () => {
  it("converts (0, 0) to (1, 1)", () => {
    expect(cursorToMonacoPosition({ line: 0, col: 0 })).toEqual({
      lineNumber: 1,
      column: 1,
    });
  });

  it("converts (5, 3) to (6, 4)", () => {
    expect(cursorToMonacoPosition({ line: 5, col: 3 })).toEqual({
      lineNumber: 6,
      column: 4,
    });
  });

  it("converts (0, 10) to (1, 11)", () => {
    expect(cursorToMonacoPosition({ line: 0, col: 10 })).toEqual({
      lineNumber: 1,
      column: 11,
    });
  });
});

describe("monacoPositionToCursor", () => {
  it("converts (1, 1) to (0, 0)", () => {
    expect(monacoPositionToCursor({ lineNumber: 1, column: 1 })).toEqual({
      line: 0,
      col: 0,
    });
  });

  it("converts (6, 4) to (5, 3)", () => {
    expect(monacoPositionToCursor({ lineNumber: 6, column: 4 })).toEqual({
      line: 5,
      col: 3,
    });
  });

  it("converts (1, 11) to (0, 10)", () => {
    expect(monacoPositionToCursor({ lineNumber: 1, column: 11 })).toEqual({
      line: 0,
      col: 10,
    });
  });

  it("is the inverse of cursorToMonacoPosition", () => {
    const cursor = { line: 3, col: 7 };
    const pos = cursorToMonacoPosition(cursor);
    expect(monacoPositionToCursor(pos)).toEqual(cursor);
  });
});
