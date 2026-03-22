/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { useVim } from "../useVim";

// =====================
// Custom renderHook implementation
// =====================

interface RenderHookResult<T> {
  result: { current: T };
  rerender: () => void;
  unmount: () => void;
}

function renderHook<T>(hookFn: () => T): RenderHookResult<T> {
  const resultRef = { current: null as unknown as T };
  const container = document.createElement("div");
  document.body.appendChild(container);

  function TestComponent() {
    resultRef.current = hookFn();
    return null;
  }

  const root = createRoot(container);

  flushSync(() => {
    root.render(React.createElement(TestComponent));
  });

  return {
    result: resultRef,
    rerender: () => {
      flushSync(() => {
        root.render(React.createElement(TestComponent));
      });
    },
    unmount: () => {
      flushSync(() => {
        root.unmount();
      });
      if (container.parentNode) {
        document.body.removeChild(container);
      }
    },
  };
}

function act(fn: () => void) {
  flushSync(fn);
}

// =====================
// Helper to create mock keyboard events
// =====================

function createKeyEvent(
  key: string,
  options: { ctrlKey?: boolean; isComposing?: boolean } = {},
): React.KeyboardEvent {
  return {
    key,
    ctrlKey: options.ctrlKey ?? false,
    preventDefault: vi.fn(),
    nativeEvent: { isComposing: options.isComposing ?? false },
  } as unknown as React.KeyboardEvent;
}

// =====================
// Tests
// =====================

describe("useVim", () => {
  // ---------------------------------------------------
  // Tab indentation with indentStyle
  // ---------------------------------------------------
  describe("Tab indentation with indentStyle", () => {
    it("inserts a tab character when indentStyle is 'tab'", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello", indentStyle: "tab" }),
      );

      act(() => {
        result.current.handleKeyDown(createKeyEvent("i"));
        result.current.handleKeyDown(createKeyEvent("Tab"));
        result.current.handleKeyDown(createKeyEvent("Escape"));
      });

      expect(result.current.content).toBe("\thello");
      unmount();
    });

    it("inserts spaces when indentStyle is 'space' (default)", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello", indentStyle: "space" }),
      );

      act(() => {
        result.current.handleKeyDown(createKeyEvent("i"));
        result.current.handleKeyDown(createKeyEvent("Tab"));
        result.current.handleKeyDown(createKeyEvent("Escape"));
      });

      // Default indentWidth is 2
      expect(result.current.content).toBe("  hello");
      unmount();
    });
  });

  // ---------------------------------------------------
  // Visual anchor consistency
  // ---------------------------------------------------
  describe("Visual anchor consistency", () => {
    it("keeps visualAnchor at the original position while cursor advances with l", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "abcdefghij" }));

      // Move cursor to col 2 first, then enter visual mode
      act(() => {
        result.current.handleKeyDown(createKeyEvent("l"));
        result.current.handleKeyDown(createKeyEvent("l"));
      });
      expect(result.current.cursor.col).toBe(2);

      // Enter visual mode - anchor should be set to current cursor position
      act(() => {
        result.current.handleKeyDown(createKeyEvent("v"));
      });
      const anchorAtStart = { ...result.current.visualAnchor! };
      expect(anchorAtStart).toEqual({ line: 0, col: 2 });

      // Move right multiple times
      act(() => {
        result.current.handleKeyDown(createKeyEvent("l"));
      });
      expect(result.current.visualAnchor).toEqual(anchorAtStart);
      expect(result.current.cursor.col).toBe(3);

      act(() => {
        result.current.handleKeyDown(createKeyEvent("l"));
      });
      expect(result.current.visualAnchor).toEqual(anchorAtStart);
      expect(result.current.cursor.col).toBe(4);

      act(() => {
        result.current.handleKeyDown(createKeyEvent("l"));
      });
      expect(result.current.visualAnchor).toEqual(anchorAtStart);
      expect(result.current.cursor.col).toBe(5);

      unmount();
    });
  });

  // ---------------------------------------------------
  // Command buffer accumulation
  // ---------------------------------------------------
  describe("Command buffer accumulation", () => {
    it("accumulates characters in commandLine as they are typed", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "hello" }));

      act(() => {
        result.current.handleKeyDown(createKeyEvent(":"));
      });
      expect(result.current.commandLine).toBe(":");

      act(() => {
        result.current.handleKeyDown(createKeyEvent("w"));
      });
      expect(result.current.commandLine).toBe(":w");

      act(() => {
        result.current.handleKeyDown(createKeyEvent("q"));
      });
      expect(result.current.commandLine).toBe(":wq");

      unmount();
    });

    it("accumulates characters for search commandLine with /", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "hello" }));

      act(() => {
        result.current.handleKeyDown(createKeyEvent("/"));
      });
      expect(result.current.commandLine).toBe("/");

      act(() => {
        result.current.handleKeyDown(createKeyEvent("f"));
        result.current.handleKeyDown(createKeyEvent("o"));
        result.current.handleKeyDown(createKeyEvent("o"));
      });
      expect(result.current.commandLine).toBe("/foo");

      unmount();
    });
  });

  // ---------------------------------------------------
  // statusError flag
  // ---------------------------------------------------
  describe("statusError flag", () => {
    it("sets statusError to true for unknown ex commands", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "hello" }));

      act(() => {
        result.current.handleKeyDown(createKeyEvent(":"));
        for (const ch of "notacommand") {
          result.current.handleKeyDown(createKeyEvent(ch));
        }
        result.current.handleKeyDown(createKeyEvent("Enter"));
      });

      expect(result.current.statusError).toBe(true);
      expect(result.current.statusMessage).toContain("E492");
      expect(result.current.statusMessage).toContain("notacommand");
      unmount();
    });

    it("reports pattern not found in statusMessage when searching for nonexistent text", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "hello world" }));

      act(() => {
        result.current.handleKeyDown(createKeyEvent("/"));
        for (const ch of "zzzzz") {
          result.current.handleKeyDown(createKeyEvent(ch));
        }
        result.current.handleKeyDown(createKeyEvent("Enter"));
      });

      expect(result.current.statusMessage).toContain("Pattern not found");
      expect(result.current.statusMessage).toContain("zzzzz");
      expect(result.current.mode).toBe("normal");
      unmount();
    });
  });

  // ---------------------------------------------------
  // lastSearch tracking
  // ---------------------------------------------------
  describe("lastSearch tracking", () => {
    it("updates lastSearch after a successful search", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "abc def ghi" }));

      act(() => {
        result.current.handleKeyDown(createKeyEvent("/"));
        for (const ch of "def") {
          result.current.handleKeyDown(createKeyEvent(ch));
        }
        result.current.handleKeyDown(createKeyEvent("Enter"));
      });

      expect(result.current.lastSearch).toBe("def");
      expect(result.current.cursor.col).toBe(4);
      unmount();
    });

    it("updates lastSearch even when pattern is not found", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "abc def ghi" }));

      act(() => {
        result.current.handleKeyDown(createKeyEvent("/"));
        for (const ch of "xyz") {
          result.current.handleKeyDown(createKeyEvent(ch));
        }
        result.current.handleKeyDown(createKeyEvent("Enter"));
      });

      expect(result.current.lastSearch).toBe("xyz");
      unmount();
    });
  });

  // ---------------------------------------------------
  // Visual mode selection then yank
  // ---------------------------------------------------
  describe("Visual mode selection then yank", () => {
    it("calls onYank with selected text and returns to normal mode", () => {
      const onYank = vi.fn();
      const { result, unmount } = renderHook(() => useVim({ content: "abcdef", onYank }));

      // Enter visual mode, select first 3 characters (a, b, c), then yank
      act(() => {
        result.current.handleKeyDown(createKeyEvent("v"));
        result.current.handleKeyDown(createKeyEvent("l"));
        result.current.handleKeyDown(createKeyEvent("l"));
        result.current.handleKeyDown(createKeyEvent("y"));
      });

      expect(onYank).toHaveBeenCalledWith("abc");
      expect(result.current.mode).toBe("normal");
      expect(result.current.visualAnchor).toBeNull();
      unmount();
    });

    it("yanks a multiline visual selection correctly", () => {
      const onYank = vi.fn();
      const { result, unmount } = renderHook(() =>
        useVim({ content: "line1\nline2\nline3", onYank }),
      );

      // Enter visual mode, move to end of line, then down to include full line2
      act(() => {
        result.current.handleKeyDown(createKeyEvent("v"));
        result.current.handleKeyDown(createKeyEvent("j"));
        result.current.handleKeyDown(createKeyEvent("$"));
        result.current.handleKeyDown(createKeyEvent("y"));
      });

      expect(onYank).toHaveBeenCalled();
      const yankedText = onYank.mock.calls[0][0];
      expect(yankedText).toContain("line1");
      expect(yankedText).toContain("line2");
      expect(result.current.mode).toBe("normal");
      unmount();
    });
  });

  // ---------------------------------------------------
  // Undo restores content
  // ---------------------------------------------------
  describe("Undo restores content", () => {
    it("restores content after dd with u", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "line1\nline2\nline3" }));

      // Delete first line
      act(() => {
        result.current.handleKeyDown(createKeyEvent("d"));
        result.current.handleKeyDown(createKeyEvent("d"));
      });
      expect(result.current.content).toBe("line2\nline3");

      // Undo
      act(() => {
        result.current.handleKeyDown(createKeyEvent("u"));
      });
      expect(result.current.content).toBe("line1\nline2\nline3");
      unmount();
    });

    it("restores content after x with u", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "hello" }));

      // Delete first character
      act(() => {
        result.current.handleKeyDown(createKeyEvent("x"));
      });
      expect(result.current.content).toBe("ello");

      // Undo
      act(() => {
        result.current.handleKeyDown(createKeyEvent("u"));
      });
      expect(result.current.content).toBe("hello");
      unmount();
    });
  });

  // ---------------------------------------------------
  // Multiple indentWidth values
  // ---------------------------------------------------
  describe("Multiple indentWidth values", () => {
    it("inserts 4 spaces when indentWidth is 4", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "hello", indentWidth: 4 }));

      act(() => {
        result.current.handleKeyDown(createKeyEvent("i"));
        result.current.handleKeyDown(createKeyEvent("Tab"));
        result.current.handleKeyDown(createKeyEvent("Escape"));
      });

      expect(result.current.content).toBe("    hello");
      // Cursor should be at col 3 (moved back by 1 on Escape from col 4)
      expect(result.current.cursor.col).toBe(3);
      unmount();
    });

    it("inserts 8 spaces when indentWidth is 8", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "hello", indentWidth: 8 }));

      act(() => {
        result.current.handleKeyDown(createKeyEvent("i"));
        result.current.handleKeyDown(createKeyEvent("Tab"));
        result.current.handleKeyDown(createKeyEvent("Escape"));
      });

      expect(result.current.content).toBe("        hello");
      unmount();
    });

    it("inserts a single tab when indentStyle='tab' regardless of indentWidth", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello", indentStyle: "tab", indentWidth: 4 }),
      );

      act(() => {
        result.current.handleKeyDown(createKeyEvent("i"));
        result.current.handleKeyDown(createKeyEvent("Tab"));
        result.current.handleKeyDown(createKeyEvent("Escape"));
      });

      // Tab character is always a single \t regardless of indentWidth
      expect(result.current.content).toBe("\thello");
      unmount();
    });
  });

  // ---------------------------------------------------
  // updateViewport affects H/M/L motions
  // ---------------------------------------------------
  describe("updateViewport affects H/M/L motions", () => {
    it("M moves cursor to the middle of the viewport", () => {
      const content = Array.from({ length: 50 }, (_, i) => `line${i}`).join("\n");
      const { result, unmount } = renderHook(() => useVim({ content }));

      // Set viewport: top at line 10, height 20 (so middle = line 10 + floor(20/2) = line 20)
      act(() => {
        result.current.updateViewport(10, 20);
      });

      act(() => {
        result.current.handleKeyDown(createKeyEvent("M"));
      });

      expect(result.current.cursor.line).toBe(20);
      unmount();
    });

    it("H moves cursor to the top of the viewport", () => {
      const content = Array.from({ length: 50 }, (_, i) => `line${i}`).join("\n");
      const { result, unmount } = renderHook(() => useVim({ content }));

      // Set viewport: top at line 15, height 20
      act(() => {
        result.current.updateViewport(15, 20);
      });

      act(() => {
        result.current.handleKeyDown(createKeyEvent("H"));
      });

      expect(result.current.cursor.line).toBe(15);
      unmount();
    });

    it("L moves cursor to the bottom of the viewport", () => {
      const content = Array.from({ length: 50 }, (_, i) => `line${i}`).join("\n");
      const { result, unmount } = renderHook(() => useVim({ content }));

      // Set viewport: top at line 10, height 20 (so bottom = 10 + 20 - 1 = 29)
      act(() => {
        result.current.updateViewport(10, 20);
      });

      act(() => {
        result.current.handleKeyDown(createKeyEvent("L"));
      });

      expect(result.current.cursor.line).toBe(29);
      unmount();
    });

    it("M changes target when viewport is updated", () => {
      const content = Array.from({ length: 50 }, (_, i) => `line${i}`).join("\n");
      const { result, unmount } = renderHook(() => useVim({ content }));

      // First viewport setting
      act(() => {
        result.current.updateViewport(0, 10);
      });
      act(() => {
        result.current.handleKeyDown(createKeyEvent("M"));
      });
      expect(result.current.cursor.line).toBe(5); // floor(10/2) = 5

      // Move back to top with gg
      act(() => {
        result.current.handleKeyDown(createKeyEvent("g"));
        result.current.handleKeyDown(createKeyEvent("g"));
      });

      // Second viewport setting (shifted)
      act(() => {
        result.current.updateViewport(20, 10);
      });
      act(() => {
        result.current.handleKeyDown(createKeyEvent("M"));
      });
      expect(result.current.cursor.line).toBe(25); // 20 + floor(10/2) = 25

      unmount();
    });
  });
});
