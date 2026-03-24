import { describe, it, expect } from "vitest";
import { getTopLine, getVisibleLines } from "../viewport";
import type { CodeMirrorView } from "../types";

function createMockView(content: string, viewportFrom: number, viewportTo: number): CodeMirrorView {
  const lines = content.split("\n");

  function lineAt(pos: number) {
    let offset = 0;
    for (let i = 0; i < lines.length; i++) {
      const lineEnd = offset + lines[i].length;
      if (pos <= lineEnd) {
        return { number: i + 1, from: offset, to: lineEnd, text: lines[i] };
      }
      offset = lineEnd + 1; // +1 for newline
    }
    const lastIdx = lines.length - 1;
    const lastFrom = content.length - lines[lastIdx].length;
    return { number: lines.length, from: lastFrom, to: content.length, text: lines[lastIdx] };
  }

  return {
    dom: null as unknown as HTMLElement,
    contentDOM: null as unknown as HTMLElement,
    state: {
      doc: {
        toString: () => content,
        length: content.length,
        lines: lines.length,
        lineAt,
        line: (n: number) => {
          let offset = 0;
          for (let i = 0; i < n - 1 && i < lines.length; i++) {
            offset += lines[i].length + 1;
          }
          const idx = n - 1;
          return {
            number: n,
            from: offset,
            to: offset + (lines[idx]?.length ?? 0),
            text: lines[idx] ?? "",
          };
        },
      },
    },
    viewport: { from: viewportFrom, to: viewportTo },
    dispatch: () => {},
    focus: () => {},
  };
}

describe("getTopLine", () => {
  it("returns 0-based first visible line", () => {
    // Viewport starts at the beginning
    const view = createMockView("aaa\nbbb\nccc\nddd", 0, 7);
    expect(getTopLine(view)).toBe(0);
  });

  it("returns correct line when viewport starts mid-document", () => {
    // "aaa\nbbb\nccc\nddd" — offset 8 is start of "ccc"
    const view = createMockView("aaa\nbbb\nccc\nddd", 8, 15);
    expect(getTopLine(view)).toBe(2);
  });
});

describe("getVisibleLines", () => {
  it("returns number of visible lines", () => {
    // Viewport covers lines 0-1 (offsets 0 to 7 = "aaa\nbbb")
    const view = createMockView("aaa\nbbb\nccc\nddd", 0, 7);
    expect(getVisibleLines(view)).toBe(2);
  });

  it("returns 1 for a single visible line", () => {
    const view = createMockView("aaa\nbbb\nccc", 0, 3);
    expect(getVisibleLines(view)).toBe(1);
  });

  it("returns full count when everything is visible", () => {
    const content = "aaa\nbbb\nccc";
    const view = createMockView(content, 0, content.length);
    expect(getVisibleLines(view)).toBe(3);
  });
});
