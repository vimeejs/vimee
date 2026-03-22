import { describe, it, expect } from "vitest";
import { TextBuffer } from "../buffer";
import { resolveMotion } from "../motion-resolver";

function buf(lines: string[]): TextBuffer {
  return new TextBuffer(lines.join("\n"));
}

function cur(line: number, col: number) {
  return { line, col };
}

// ---------- Basic movement: h / ArrowLeft ----------

describe("resolveMotion: h and ArrowLeft", () => {
  it("h moves cursor left by count", () => {
    const b = buf(["hello"]);
    const result = resolveMotion("h", cur(0, 3), b, 1, false);
    expect(result).not.toBeNull();
    expect(result!.cursor).toEqual(cur(0, 2));
  });

  it("h moves left by count=2", () => {
    const b = buf(["hello"]);
    const result = resolveMotion("h", cur(0, 4), b, 2, false);
    expect(result!.cursor).toEqual(cur(0, 2));
  });

  it("h clamps at column 0", () => {
    const b = buf(["hello"]);
    const result = resolveMotion("h", cur(0, 1), b, 10, false);
    expect(result!.cursor).toEqual(cur(0, 0));
  });

  it("ArrowLeft behaves the same as h", () => {
    const b = buf(["hello"]);
    const result = resolveMotion("ArrowLeft", cur(0, 3), b, 1, false);
    expect(result).not.toBeNull();
    expect(result!.cursor).toEqual(cur(0, 2));
  });

  it("ArrowLeft clamps at column 0", () => {
    const b = buf(["hello"]);
    const result = resolveMotion("ArrowLeft", cur(0, 0), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 0));
  });
});

// ---------- Basic movement: j / ArrowDown ----------

describe("resolveMotion: j and ArrowDown", () => {
  it("j moves cursor down by count", () => {
    const b = buf(["hello", "world"]);
    const result = resolveMotion("j", cur(0, 2), b, 1, false);
    expect(result).not.toBeNull();
    expect(result!.cursor).toEqual(cur(1, 2));
  });

  it("j clamps at last line", () => {
    const b = buf(["hello", "world"]);
    const result = resolveMotion("j", cur(0, 0), b, 10, false);
    expect(result!.cursor.line).toBe(1);
  });

  it("j clamps col when target line is shorter", () => {
    const b = buf(["hello world", "hi"]);
    const result = resolveMotion("j", cur(0, 8), b, 1, false);
    expect(result!.cursor).toEqual(cur(1, 1));
  });

  it("j returns linewise range", () => {
    const b = buf(["hello", "world"]);
    const result = resolveMotion("j", cur(0, 0), b, 1, false);
    expect(result!.range.linewise).toBe(true);
  });

  it("ArrowDown behaves the same as j", () => {
    const b = buf(["hello", "world"]);
    const result = resolveMotion("ArrowDown", cur(0, 2), b, 1, false);
    expect(result).not.toBeNull();
    expect(result!.cursor).toEqual(cur(1, 2));
  });
});

// ---------- Basic movement: k / ArrowUp ----------

describe("resolveMotion: k and ArrowUp", () => {
  it("k moves cursor up by count", () => {
    const b = buf(["hello", "world"]);
    const result = resolveMotion("k", cur(1, 2), b, 1, false);
    expect(result).not.toBeNull();
    expect(result!.cursor).toEqual(cur(0, 2));
  });

  it("k clamps at first line", () => {
    const b = buf(["hello", "world"]);
    const result = resolveMotion("k", cur(1, 0), b, 10, false);
    expect(result!.cursor.line).toBe(0);
  });

  it("k clamps col when target line is shorter", () => {
    const b = buf(["hi", "hello world"]);
    const result = resolveMotion("k", cur(1, 8), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 1));
  });

  it("k returns linewise range", () => {
    const b = buf(["hello", "world"]);
    const result = resolveMotion("k", cur(1, 0), b, 1, false);
    expect(result!.range.linewise).toBe(true);
  });

  it("ArrowUp behaves the same as k", () => {
    const b = buf(["hello", "world"]);
    const result = resolveMotion("ArrowUp", cur(1, 2), b, 1, false);
    expect(result).not.toBeNull();
    expect(result!.cursor).toEqual(cur(0, 2));
  });
});

// ---------- Basic movement: l / ArrowRight ----------

describe("resolveMotion: l and ArrowRight", () => {
  it("l moves cursor right by count", () => {
    const b = buf(["hello"]);
    const result = resolveMotion("l", cur(0, 0), b, 1, false);
    expect(result).not.toBeNull();
    expect(result!.cursor).toEqual(cur(0, 1));
  });

  it("l clamps at end of line", () => {
    const b = buf(["hello"]);
    const result = resolveMotion("l", cur(0, 3), b, 10, false);
    expect(result!.cursor).toEqual(cur(0, 4));
  });

  it("l does not move on empty line", () => {
    const b = buf([""]);
    const result = resolveMotion("l", cur(0, 0), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 0));
  });

  it("ArrowRight behaves the same as l", () => {
    const b = buf(["hello"]);
    const result = resolveMotion("ArrowRight", cur(0, 0), b, 1, false);
    expect(result).not.toBeNull();
    expect(result!.cursor).toEqual(cur(0, 1));
  });

  it("ArrowRight clamps at end of line", () => {
    const b = buf(["hi"]);
    const result = resolveMotion("ArrowRight", cur(0, 1), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 1));
  });
});
