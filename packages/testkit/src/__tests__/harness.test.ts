import { describe, it, expect } from "vitest";
import { vim } from "../index";

describe("vim() factory", () => {
  it("creates a harness with text content", () => {
    const v = vim("hello");
    expect(v.content()).toBe("hello");
  });

  it("defaults cursor to 0,0", () => {
    const v = vim("hello");
    expect(v.cursor()).toEqual({ line: 0, col: 0 });
  });

  it("defaults to normal mode", () => {
    const v = vim("hello");
    expect(v.mode()).toBe("normal");
  });

  it("accepts cursor option as [line, col]", () => {
    const v = vim("hello\nworld", { cursor: [1, 3] });
    expect(v.cursor()).toEqual({ line: 1, col: 3 });
  });
});

describe("VimHarness.type()", () => {
  it("processes single key", () => {
    const v = vim("hello");
    v.type("x");
    expect(v.content()).toBe("ello");
  });

  it("processes multi-key sequence", () => {
    const v = vim("hello\nworld\nfoo", { cursor: [1, 0] });
    v.type("dd");
    expect(v.content()).toBe("hello\nfoo");
  });

  it("supports count prefix", () => {
    const v = vim("abcdef");
    v.type("3x");
    expect(v.content()).toBe("def");
  });

  it("supports Ctrl keys with <C-x> notation", () => {
    const v = vim("line1\nline2\nline3\nline4\nline5");
    // Ctrl-d emits a scroll down action
    v.type("<C-d>");
    expect(v.actions()).toContainEqual({
      type: "scroll",
      direction: "down",
      amount: 0.5,
    });
  });

  it("supports <Esc> notation", () => {
    const v = vim("hello");
    v.type("i");
    expect(v.mode()).toBe("insert");
    v.type("<Esc>");
    expect(v.mode()).toBe("normal");
  });

  it("processes operator + insert text when second arg is given", () => {
    const v = vim("hello world");
    v.type("ciw", "foo");
    expect(v.content()).toBe("foo world");
    expect(v.mode()).toBe("normal");
  });

  it("is chainable", () => {
    const v = vim("hello");
    v.type("x").type("x");
    expect(v.content()).toBe("llo");
  });
});

describe("VimHarness accessors", () => {
  it("lines() returns array of lines", () => {
    const v = vim("hello\nworld");
    expect(v.lines()).toEqual(["hello", "world"]);
  });

  it("line(n) returns specific line", () => {
    const v = vim("hello\nworld\nfoo");
    expect(v.line(1)).toBe("world");
  });

  it("mode() reflects mode changes", () => {
    const v = vim("hello");
    expect(v.mode()).toBe("normal");
    v.type("i");
    expect(v.mode()).toBe("insert");
    v.type("<Esc>");
    expect(v.mode()).toBe("normal");
  });

  it("register() returns register content", () => {
    const v = vim("hello\nworld");
    v.type("dd");
    expect(v.register('"')).toBe("hello\n");
  });

  it("actions() returns actions from last type() call", () => {
    const v = vim("hello");
    v.type("x");
    const actions = v.actions();
    expect(actions.some((a) => a.type === "content-change")).toBe(true);
  });

  it("allActions() returns cumulative actions", () => {
    const v = vim("hello");
    v.type("x");
    v.type("x");
    expect(v.allActions().length).toBeGreaterThan(v.actions().length);
  });

  it("statusMessage() returns current status", () => {
    const v = vim("hello");
    v.type("i");
    expect(v.statusMessage()).toBe("-- INSERT --");
  });
});

describe("VimHarness.raw()", () => {
  it("exposes internal ctx and buffer", () => {
    const v = vim("hello");
    const { ctx, buffer } = v.raw();
    expect(ctx.mode).toBe("normal");
    expect(buffer.getLineCount()).toBe(1);
    expect(buffer.getContent()).toBe("hello");
  });
});

describe("VimHarness mode-specific init", () => {
  it("initializes in insert mode", () => {
    const v = vim("hello", { mode: "insert" });
    expect(v.mode()).toBe("insert");
  });

  it("initializes in visual mode with anchor", () => {
    const v = vim("hello world", {
      mode: "visual",
      cursor: [0, 5],
      anchor: [0, 0],
    });
    expect(v.mode()).toBe("visual");
    expect(v.raw().ctx.visualAnchor).toEqual({ line: 0, col: 0 });
  });

  it("initializes in visual-line mode", () => {
    const v = vim("hello\nworld", {
      mode: "visual-line",
      cursor: [1, 0],
      anchor: [0, 0],
    });
    expect(v.mode()).toBe("visual-line");
  });
});
