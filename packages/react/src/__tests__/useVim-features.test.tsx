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
  // Scroll handling
  // ---------------------------------------------------
  describe("handleScroll", () => {
    it("scrolls cursor down with handleScroll('down', ...)", () => {
      const { result, unmount } = renderHook(() =>
        useVim({
          content: Array.from({ length: 100 }, (_, i) => `line${i}`).join("\n"),
        }),
      );

      act(() => {
        result.current.handleScroll("down", 20, 0.5);
      });

      expect(result.current.cursor.line).toBe(10);
      unmount();
    });

    it("scrolls cursor up with handleScroll('up', ...)", () => {
      const { result, unmount } = renderHook(() =>
        useVim({
          content: Array.from({ length: 100 }, (_, i) => `line${i}`).join("\n"),
          cursorPosition: "51:1",
        }),
      );

      act(() => {
        result.current.handleScroll("up", 20, 0.5);
      });

      expect(result.current.cursor.line).toBe(40);
      unmount();
    });

    it("clamps cursor to first line when scrolling up beyond buffer", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "line1\nline2\nline3", cursorPosition: "2:1" }),
      );

      act(() => {
        result.current.handleScroll("up", 100, 1.0);
      });

      expect(result.current.cursor.line).toBe(0);
      unmount();
    });

    it("clamps cursor to last line when scrolling down beyond buffer", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "line1\nline2\nline3" }));

      act(() => {
        result.current.handleScroll("down", 100, 1.0);
      });

      expect(result.current.cursor.line).toBe(2);
      unmount();
    });
  });

  // ---------------------------------------------------
  // Viewport
  // ---------------------------------------------------
  describe("updateViewport", () => {
    it("updates viewport without crashing", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "hello" }));

      act(() => {
        result.current.updateViewport(10, 30);
      });

      expect(result.current.mode).toBe("normal");
      unmount();
    });
  });

  // ---------------------------------------------------
  // preventDefault
  // ---------------------------------------------------
  describe("preventDefault", () => {
    it("prevents default for Ctrl-R", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "hello" }));

      const event = createKeyEvent("r", { ctrlKey: true });
      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      unmount();
    });

    it("prevents default for Ctrl-D", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "hello" }));

      const event = createKeyEvent("d", { ctrlKey: true });
      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      unmount();
    });

    it("prevents default for Tab", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "hello" }));

      const event = createKeyEvent("Tab");
      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      unmount();
    });

    it("prevents default for Escape", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "hello" }));

      const event = createKeyEvent("Escape");
      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      unmount();
    });

    it("prevents default for /", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "hello" }));

      const event = createKeyEvent("/");
      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      unmount();
    });

    it("does not prevent default for regular character keys", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "hello" }));

      const event = createKeyEvent("j");
      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).not.toHaveBeenCalled();
      unmount();
    });
  });

  // ---------------------------------------------------
  // Status message and command line
  // ---------------------------------------------------
  describe("Status and command line", () => {
    it("shows command line when in command-line mode", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "hello" }));

      act(() => {
        result.current.handleKeyDown(createKeyEvent(":"));
        result.current.handleKeyDown(createKeyEvent("w"));
      });

      expect(result.current.commandLine).toBe(":w");
      unmount();
    });

    it("clears command line after executing command", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "hello" }));

      act(() => {
        result.current.handleKeyDown(createKeyEvent(":"));
        result.current.handleKeyDown(createKeyEvent("w"));
        result.current.handleKeyDown(createKeyEvent("Enter"));
      });

      expect(result.current.commandLine).toBe("");
      unmount();
    });

    it("shows status message for multi-line yank", () => {
      const { result, unmount } = renderHook(() =>
        useVim({
          content: Array.from({ length: 10 }, (_, i) => `line${i}`).join("\n"),
        }),
      );

      act(() => {
        result.current.handleKeyDown(createKeyEvent("5"));
        result.current.handleKeyDown(createKeyEvent("y"));
        result.current.handleKeyDown(createKeyEvent("y"));
      });

      expect(result.current.statusMessage).toBe("5 lines yanked");
      unmount();
    });
  });

  // ---------------------------------------------------
  // :set option
  // ---------------------------------------------------
  describe(":set option", () => {
    it("sets number option with :set number", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "hello" }));

      act(() => {
        result.current.handleKeyDown(createKeyEvent(":"));
        for (const ch of "set number") {
          result.current.handleKeyDown(createKeyEvent(ch));
        }
        result.current.handleKeyDown(createKeyEvent("Enter"));
      });

      expect(result.current.options.number).toBe(true);
      unmount();
    });
  });

  // ---------------------------------------------------
  // Search
  // ---------------------------------------------------
  describe("Search", () => {
    it("updates lastSearch after search", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "hello world foo" }));

      act(() => {
        result.current.handleKeyDown(createKeyEvent("/"));
        result.current.handleKeyDown(createKeyEvent("f"));
        result.current.handleKeyDown(createKeyEvent("o"));
        result.current.handleKeyDown(createKeyEvent("o"));
        result.current.handleKeyDown(createKeyEvent("Enter"));
      });

      expect(result.current.lastSearch).toBe("foo");
      expect(result.current.cursor.col).toBe(12);
      unmount();
    });
  });

  // ---------------------------------------------------
  // Complex workflows
  // ---------------------------------------------------
  describe("Complex workflows", () => {
    it("dd then p (cut and paste)", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "line1\nline2\nline3" }));

      act(() => {
        result.current.handleKeyDown(createKeyEvent("d"));
        result.current.handleKeyDown(createKeyEvent("d"));
      });
      expect(result.current.content).toBe("line2\nline3");

      act(() => {
        result.current.handleKeyDown(createKeyEvent("p"));
      });
      expect(result.current.content).toBe("line2\nline1\nline3");
      unmount();
    });

    it("ciw replaces a word", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "hello world" }));

      act(() => {
        result.current.handleKeyDown(createKeyEvent("c"));
        result.current.handleKeyDown(createKeyEvent("i"));
        result.current.handleKeyDown(createKeyEvent("w"));
        result.current.handleKeyDown(createKeyEvent("f"));
        result.current.handleKeyDown(createKeyEvent("o"));
        result.current.handleKeyDown(createKeyEvent("o"));
        result.current.handleKeyDown(createKeyEvent("Escape"));
      });

      expect(result.current.content).toBe("foo world");
      expect(result.current.mode).toBe("normal");
      unmount();
    });

    it("visual select then delete", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "abcdef" }));

      act(() => {
        result.current.handleKeyDown(createKeyEvent("v"));
        result.current.handleKeyDown(createKeyEvent("l"));
        result.current.handleKeyDown(createKeyEvent("l"));
        result.current.handleKeyDown(createKeyEvent("d"));
      });

      expect(result.current.content).toBe("def");
      expect(result.current.mode).toBe("normal");
      unmount();
    });
  });
});
