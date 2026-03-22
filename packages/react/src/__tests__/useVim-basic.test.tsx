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
  // Initialization
  // ---------------------------------------------------
  describe("Initialization", () => {
    it("initializes with the given content", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "hello world" }));
      expect(result.current.content).toBe("hello world");
      unmount();
    });

    it("initializes in normal mode", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "test" }));
      expect(result.current.mode).toBe("normal");
      unmount();
    });

    it("initializes cursor at 0,0 by default", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "test" }));
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
      const { result, unmount } = renderHook(() => useVim({ content: "" }));
      expect(result.current.statusMessage).toBe("");
      unmount();
    });

    it("starts with null visualAnchor", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "" }));
      expect(result.current.visualAnchor).toBeNull();
      unmount();
    });

    it("starts with empty commandLine", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "" }));
      expect(result.current.commandLine).toBe("");
      unmount();
    });

    it("starts with empty options", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "" }));
      expect(result.current.options).toEqual({});
      unmount();
    });

    it("starts with empty lastSearch", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "" }));
      expect(result.current.lastSearch).toBe("");
      unmount();
    });
  });

  // ---------------------------------------------------
  // Keyboard event handling
  // ---------------------------------------------------
  describe("Keyboard event handling", () => {
    it("moves cursor right with l", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "hello world" }));

      act(() => {
        result.current.handleKeyDown(createKeyEvent("l"));
      });

      expect(result.current.cursor.col).toBe(1);
      unmount();
    });

    it("moves cursor down with j", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "line1\nline2\nline3" }));

      act(() => {
        result.current.handleKeyDown(createKeyEvent("j"));
      });

      expect(result.current.cursor.line).toBe(1);
      unmount();
    });

    it("enters insert mode with i", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "hello" }));

      act(() => {
        result.current.handleKeyDown(createKeyEvent("i"));
      });

      expect(result.current.mode).toBe("insert");
      unmount();
    });

    it("returns to normal mode with Escape from insert mode", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "hello" }));

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
      const { result, unmount } = renderHook(() => useVim({ content: "hello" }));

      act(() => {
        result.current.handleKeyDown(createKeyEvent("v"));
      });

      expect(result.current.mode).toBe("visual");
      expect(result.current.visualAnchor).not.toBeNull();
      unmount();
    });

    it("enters command-line mode with :", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "hello" }));

      act(() => {
        result.current.handleKeyDown(createKeyEvent(":"));
      });

      expect(result.current.mode).toBe("command-line");
      expect(result.current.commandLine).toBe(":");
      unmount();
    });

    it("ignores IME composing events", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "hello" }));

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
      const { result, unmount } = renderHook(() => useVim({ content: "line1\nline2\nline3" }));

      act(() => {
        result.current.handleKeyDown(createKeyEvent("d"));
        result.current.handleKeyDown(createKeyEvent("d"));
      });

      expect(result.current.content).toBe("line2\nline3");
      unmount();
    });

    it("updates content when inserting text", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "hello" }));

      act(() => {
        result.current.handleKeyDown(createKeyEvent("i"));
        result.current.handleKeyDown(createKeyEvent("X"));
        result.current.handleKeyDown(createKeyEvent("Escape"));
      });

      expect(result.current.content).toBe("Xhello");
      unmount();
    });

    it("updates content when using x to delete characters", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "hello" }));

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
      const { result, unmount } = renderHook(() => useVim({ content: "hello", onChange }));

      act(() => {
        result.current.handleKeyDown(createKeyEvent("x"));
      });

      expect(onChange).toHaveBeenCalledWith("ello");
      unmount();
    });

    it("calls onModeChange when mode changes", () => {
      const onModeChange = vi.fn();
      const { result, unmount } = renderHook(() => useVim({ content: "hello", onModeChange }));

      act(() => {
        result.current.handleKeyDown(createKeyEvent("i"));
      });

      expect(onModeChange).toHaveBeenCalledWith("insert");
      unmount();
    });

    it("calls onYank when text is yanked", () => {
      const onYank = vi.fn();
      const { result, unmount } = renderHook(() => useVim({ content: "hello world", onYank }));

      act(() => {
        result.current.handleKeyDown(createKeyEvent("y"));
        result.current.handleKeyDown(createKeyEvent("w"));
      });

      expect(onYank).toHaveBeenCalledWith("hello ");
      unmount();
    });

    it("calls onSave when :w is executed", () => {
      const onSave = vi.fn();
      const { result, unmount } = renderHook(() => useVim({ content: "hello", onSave }));

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
      const { result, unmount } = renderHook(() => useVim({ content: "hello", onAction }));

      act(() => {
        result.current.handleKeyDown(createKeyEvent("x"));
      });

      expect(onAction).toHaveBeenCalled();
      const actionTypes = onAction.mock.calls.map(([action]: any[]) => action.type);
      expect(actionTypes).toContain("content-change");
      unmount();
    });
  });

  // ---------------------------------------------------
  // readOnly mode
  // ---------------------------------------------------
  describe("readOnly mode", () => {
    it("blocks insert mode in readOnly", () => {
      const { result, unmount } = renderHook(() => useVim({ content: "hello", readOnly: true }));

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
      const { result, unmount } = renderHook(() => useVim({ content: "hello", readOnly: true }));

      act(() => {
        result.current.handleKeyDown(createKeyEvent("x"));
      });

      expect(result.current.content).toBe("hello");
      unmount();
    });
  });
});
