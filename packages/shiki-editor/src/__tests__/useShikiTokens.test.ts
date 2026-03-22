/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useShikiTokens } from "../hooks/useShikiTokens";
import type { ShikiTokenResult } from "../hooks/useShikiTokens";
import type { HighlighterGeneric, ThemedToken } from "shiki/types";

/**
 * Minimal renderHook using renderToStaticMarkup.
 * Captures the hook result via a ref-like object during render.
 */
function renderHook<T>(hookFn: () => T): { result: T } {
  let result: T | undefined;
  function TestComponent() {
    result = hookFn();
    return null;
  }
  renderToStaticMarkup(createElement(TestComponent));
  return { result: result as T };
}

/** Create a mock highlighter that returns the given codeToTokens result */
function createMockHighlighter(codeToTokensResult: {
  bg?: string;
  fg?: string;
  tokens: ThemedToken[][];
}): HighlighterGeneric<string, string> {
  return {
    codeToTokens: vi.fn().mockReturnValue(codeToTokensResult),
  } as unknown as HighlighterGeneric<string, string>;
}

/** Create a mock highlighter that throws on codeToTokens */
function createThrowingHighlighter(): HighlighterGeneric<string, string> {
  return {
    codeToTokens: vi.fn().mockImplementation(() => {
      throw new Error("Tokenization failed");
    }),
  } as unknown as HighlighterGeneric<string, string>;
}

describe("useShikiTokens", () => {
  it("extracts tokenLines, bgColor, and fgColor from highlighter result", () => {
    const mockTokens: ThemedToken[][] = [
      [
        { content: "const", color: "#569cd6", offset: 0 } as ThemedToken,
        { content: " x", color: "#d4d4d4", offset: 5 } as ThemedToken,
      ],
      [{ content: "return", color: "#c586c0", offset: 0 } as ThemedToken],
    ];

    const highlighter = createMockHighlighter({
      bg: "#282c34",
      fg: "#abb2bf",
      tokens: mockTokens,
    });

    const { result } = renderHook(() =>
      useShikiTokens(highlighter, "const x\nreturn", "typescript", "one-dark-pro"),
    );

    expect(result.tokenLines).toBe(mockTokens);
    expect(result.bgColor).toBe("#282c34");
    expect(result.fgColor).toBe("#abb2bf");

    expect(highlighter.codeToTokens).toHaveBeenCalledWith("const x\nreturn", {
      lang: "typescript",
      theme: "one-dark-pro",
    });
  });

  it("falls back to plain text tokens when highlighter throws", () => {
    const highlighter = createThrowingHighlighter();

    const { result } = renderHook(() =>
      useShikiTokens(highlighter, "line one\nline two\nline three", "javascript", "github-dark"),
    );

    expect(result.tokenLines).toHaveLength(3);
    expect(result.tokenLines[0]).toHaveLength(1);
    expect(result.tokenLines[0][0].content).toBe("line one");
    expect(result.tokenLines[1][0].content).toBe("line two");
    expect(result.tokenLines[2][0].content).toBe("line three");

    expect(result.bgColor).toBe("#1e1e1e");
    expect(result.fgColor).toBe("#d4d4d4");
  });

  it("uses default colors when bg/fg are undefined in result", () => {
    const mockTokens: ThemedToken[][] = [
      [{ content: "hello", color: "#fff", offset: 0 } as ThemedToken],
    ];

    const highlighter = createMockHighlighter({
      bg: undefined,
      fg: undefined,
      tokens: mockTokens,
    });

    const { result } = renderHook(() =>
      useShikiTokens(highlighter, "hello", "plaintext", "custom-theme"),
    );

    expect(result.tokenLines).toBe(mockTokens);
    expect(result.bgColor).toBe("#1e1e1e");
    expect(result.fgColor).toBe("#d4d4d4");
  });

  it("passes extraOptions to codeToTokens", () => {
    const highlighter = createMockHighlighter({
      bg: "#000",
      fg: "#fff",
      tokens: [[{ content: "x", offset: 0 } as ThemedToken]],
    });

    renderHook(() =>
      useShikiTokens(highlighter, "x", "rust", "dracula", {
        includeExplanation: true,
      }),
    );

    expect(highlighter.codeToTokens).toHaveBeenCalledWith("x", {
      lang: "rust",
      theme: "dracula",
      includeExplanation: true,
    });
  });

  it("returns single fallback token per line with correct offset on error", () => {
    const highlighter = createThrowingHighlighter();

    const { result } = renderHook(() => useShikiTokens(highlighter, "single line", "go", "nord"));

    expect(result.tokenLines).toHaveLength(1);
    const token = result.tokenLines[0][0];
    expect(token.content).toBe("single line");
    expect(token.offset).toBe(0);
  });
});
