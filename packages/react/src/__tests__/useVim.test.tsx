/**
 * useVim.test.tsx
 *
 * Tests for the useVim React hook.
 * Uses a minimal custom renderHook to avoid @testing-library/react
 * compatibility issues with React 19 + Bun.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { useVim } from "../useVim";
import type { UseVimReturn } from "../useVim";

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
  // Initialization
  // ---------------------------------------------------
  describe("Initialization", () => {
    it("initializes with the given content", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello world" }),
      );
      expect(result.current.content).toBe("hello world");
      unmount();
    });

    it("initializes in normal mode", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "test" }),
      );
      expect(result.current.mode).toBe("normal");
      unmount();
    });

    it("initializes cursor at 0,0 by default", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "test" }),
      );
      expect(result.current.cursor).toEqual({ line: 0, col: 0 });
      unmount();
    });

    it("parses cursorPosition string (1-based)", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "line1\nline2\nline3", cursorPosition: "2:3" }),
      );
      expect(result.current.cursor).toEqual({ line: 1, col: 2 });
      unmount();
    });

    it("starts with empty status message", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "" }),
      );
      expect(result.current.statusMessage).toBe("");
      unmount();
    });

    it("starts with null visualAnchor", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "" }),
      );
      expect(result.current.visualAnchor).toBeNull();
      unmount();
    });

    it("starts with empty commandLine", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "" }),
      );
      expect(result.current.commandLine).toBe("");
      unmount();
    });

    it("starts with empty options", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "" }),
      );
      expect(result.current.options).toEqual({});
      unmount();
    });

    it("starts with empty lastSearch", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "" }),
      );
      expect(result.current.lastSearch).toBe("");
      unmount();
    });
  });

  // ---------------------------------------------------
  // Keyboard event handling
  // ---------------------------------------------------
  describe("Keyboard event handling", () => {
    it("moves cursor right with l", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello world" }),
      );

      act(() => {
        result.current.handleKeyDown(createKeyEvent("l"));
      });

      expect(result.current.cursor.col).toBe(1);
      unmount();
    });

    it("moves cursor down with j", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "line1\nline2\nline3" }),
      );

      act(() => {
        result.current.handleKeyDown(createKeyEvent("j"));
      });

      expect(result.current.cursor.line).toBe(1);
      unmount();
    });

    it("enters insert mode with i", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello" }),
      );

      act(() => {
        result.current.handleKeyDown(createKeyEvent("i"));
      });

      expect(result.current.mode).toBe("insert");
      unmount();
    });

    it("returns to normal mode with Escape from insert mode", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello" }),
      );

      act(() => {
        result.current.handleKeyDown(createKeyEvent("i"));
      });
      expect(result.current.mode).toBe("insert");

      act(() => {
        result.current.handleKeyDown(createKeyEvent("Escape"));
      });
      expect(result.current.mode).toBe("normal");
      unmount();
    });

    it("enters visual mode with v", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello" }),
      );

      act(() => {
        result.current.handleKeyDown(createKeyEvent("v"));
      });

      expect(result.current.mode).toBe("visual");
      expect(result.current.visualAnchor).not.toBeNull();
      unmount();
    });

    it("enters command-line mode with :", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello" }),
      );

      act(() => {
        result.current.handleKeyDown(createKeyEvent(":"));
      });

      expect(result.current.mode).toBe("command-line");
      expect(result.current.commandLine).toBe(":");
      unmount();
    });

    it("ignores IME composing events", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello" }),
      );

      act(() => {
        result.current.handleKeyDown(createKeyEvent("a", { isComposing: true }));
      });

      expect(result.current.mode).toBe("normal");
      unmount();
    });
  });

  // ---------------------------------------------------
  // Content changes
  // ---------------------------------------------------
  describe("Content changes", () => {
    it("updates content when deleting with dd", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "line1\nline2\nline3" }),
      );

      act(() => {
        result.current.handleKeyDown(createKeyEvent("d"));
        result.current.handleKeyDown(createKeyEvent("d"));
      });

      expect(result.current.content).toBe("line2\nline3");
      unmount();
    });

    it("updates content when inserting text", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello" }),
      );

      act(() => {
        result.current.handleKeyDown(createKeyEvent("i"));
        result.current.handleKeyDown(createKeyEvent("X"));
        result.current.handleKeyDown(createKeyEvent("Escape"));
      });

      expect(result.current.content).toBe("Xhello");
      unmount();
    });

    it("updates content when using x to delete characters", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello" }),
      );

      act(() => {
        result.current.handleKeyDown(createKeyEvent("x"));
      });

      expect(result.current.content).toBe("ello");
      unmount();
    });
  });

  // ---------------------------------------------------
  // Callbacks
  // ---------------------------------------------------
  describe("Callbacks", () => {
    it("calls onChange when content changes", () => {
      const onChange = vi.fn();
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello", onChange }),
      );

      act(() => {
        result.current.handleKeyDown(createKeyEvent("x"));
      });

      expect(onChange).toHaveBeenCalledWith("ello");
      unmount();
    });

    it("calls onModeChange when mode changes", () => {
      const onModeChange = vi.fn();
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello", onModeChange }),
      );

      act(() => {
        result.current.handleKeyDown(createKeyEvent("i"));
      });

      expect(onModeChange).toHaveBeenCalledWith("insert");
      unmount();
    });

    it("calls onYank when text is yanked", () => {
      const onYank = vi.fn();
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello world", onYank }),
      );

      act(() => {
        result.current.handleKeyDown(createKeyEvent("y"));
        result.current.handleKeyDown(createKeyEvent("w"));
      });

      expect(onYank).toHaveBeenCalledWith("hello ");
      unmount();
    });

    it("calls onSave when :w is executed", () => {
      const onSave = vi.fn();
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello", onSave }),
      );

      act(() => {
        result.current.handleKeyDown(createKeyEvent(":"));
        result.current.handleKeyDown(createKeyEvent("w"));
        result.current.handleKeyDown(createKeyEvent("Enter"));
      });

      expect(onSave).toHaveBeenCalledWith("hello");
      unmount();
    });

    it("calls onAction for every action", () => {
      const onAction = vi.fn();
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello", onAction }),
      );

      act(() => {
        result.current.handleKeyDown(createKeyEvent("x"));
      });

      expect(onAction).toHaveBeenCalled();
      const actionTypes = onAction.mock.calls.map(
        ([action]: [any]) => action.type,
      );
      expect(actionTypes).toContain("content-change");
      unmount();
    });
  });

  // ---------------------------------------------------
  // readOnly mode
  // ---------------------------------------------------
  describe("readOnly mode", () => {
    it("blocks insert mode in readOnly", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello", readOnly: true }),
      );

      act(() => {
        result.current.handleKeyDown(createKeyEvent("i"));
      });

      expect(result.current.mode).toBe("normal");
      unmount();
    });

    it("allows motions in readOnly", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello world", readOnly: true }),
      );

      act(() => {
        result.current.handleKeyDown(createKeyEvent("w"));
      });

      expect(result.current.cursor.col).toBe(6);
      unmount();
    });

    it("blocks x (delete) in readOnly", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello", readOnly: true }),
      );

      act(() => {
        result.current.handleKeyDown(createKeyEvent("x"));
      });

      expect(result.current.content).toBe("hello");
      unmount();
    });
  });

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
      const { result, unmount } = renderHook(() =>
        useVim({ content: "line1\nline2\nline3" }),
      );

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
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello" }),
      );

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
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello" }),
      );

      const event = createKeyEvent("r", { ctrlKey: true });
      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      unmount();
    });

    it("prevents default for Ctrl-D", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello" }),
      );

      const event = createKeyEvent("d", { ctrlKey: true });
      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      unmount();
    });

    it("prevents default for Tab", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello" }),
      );

      const event = createKeyEvent("Tab");
      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      unmount();
    });

    it("prevents default for Escape", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello" }),
      );

      const event = createKeyEvent("Escape");
      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      unmount();
    });

    it("prevents default for /", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello" }),
      );

      const event = createKeyEvent("/");
      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      unmount();
    });

    it("does not prevent default for regular character keys", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello" }),
      );

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
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello" }),
      );

      act(() => {
        result.current.handleKeyDown(createKeyEvent(":"));
        result.current.handleKeyDown(createKeyEvent("w"));
      });

      expect(result.current.commandLine).toBe(":w");
      unmount();
    });

    it("clears command line after executing command", () => {
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello" }),
      );

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
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello" }),
      );

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
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello world foo" }),
      );

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
      const { result, unmount } = renderHook(() =>
        useVim({ content: "line1\nline2\nline3" }),
      );

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
      const { result, unmount } = renderHook(() =>
        useVim({ content: "hello world" }),
      );

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
      const { result, unmount } = renderHook(() =>
        useVim({ content: "abcdef" }),
      );

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
