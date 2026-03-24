/**
 * useVim.ts
 *
 * Main React hook for the vimee headless vim engine.
 * Integrates the text buffer, Vim state, and keyboard event handling.
 *
 * This hook manages:
 * - TextBuffer management (via ref for mutability)
 * - VimContext state machine (via ref)
 * - Display state (cursor, mode, content, etc.)
 * - Keyboard event processing
 * - Callback invocation (onChange, onYank, onSave, onModeChange, onAction)
 * - Scroll handling (Ctrl-U/D/B/F)
 * - Viewport info for H/M/L motions
 * - Declarative keybinds and commands props
 */

import { useCallback, useRef, useState } from "react";
import type { CursorPosition, VimMode, VimAction, VimContext, BufferReader } from "@vimee/core";
import type { KeybindMap } from "@vimee/core";
import type { CommandMap } from "@vimee/core";
import {
  TextBuffer,
  createInitialContext,
  parseCursorPosition,
  processKeystroke,
  createKeybindMap,
  createCommandMap,
  actions,
} from "@vimee/core";

/** Declarative keybind entry for useVim props */
export interface KeybindEntry {
  /** Vim mode this keybind applies to */
  mode: VimMode;
  /** Key sequence (e.g., "\\i", "<C-s>", "jk") */
  keys: string;
  /** Callback that returns VimActions (mutually exclusive with remap) */
  execute?: (ctx: Readonly<VimContext>, buffer: BufferReader) => VimAction[];
  /** Remap to another key sequence (mutually exclusive with execute) */
  remap?: string;
}

/** Declarative command entry for useVim props */
export interface CommandEntry {
  /** Command name (matched exactly when user types :name) */
  name: string;
  /** Callback that receives args and returns VimActions */
  execute: (args: string, ctx: Readonly<VimContext>, buffer: BufferReader) => VimAction[];
}

/** Options for the useVim hook */
export interface UseVimOptions {
  /** Initial content */
  content: string;
  /** Initial cursor position ("1:1" format, 1-based) */
  cursorPosition?: string;
  /** Read-only mode */
  readOnly?: boolean;
  /** Callback when content changes */
  onChange?: (content: string) => void;
  /** Callback when text is yanked */
  onYank?: (text: string) => void;
  /** Callback when :w is executed */
  onSave?: (content: string) => void;
  /** Callback when mode changes */
  onModeChange?: (mode: VimMode) => void;
  /** Callback for every action emitted by the vim engine */
  onAction?: (action: VimAction, key: string) => void;
  /** Indent style: "space" or "tab" (default: "space") */
  indentStyle?: "space" | "tab";
  /** Number of spaces (or tab width) per indent level (default: 2) */
  indentWidth?: number;
  /**
   * Custom keybindings (declarative).
   * Rebuilt only when the array reference changes.
   *
   * @example
   * ```ts
   * const keybinds = useMemo(() => [
   *   { mode: "normal", keys: "\\i", execute: (ctx, buf) => [actions.statusMessage("info")] },
   *   { mode: "normal", keys: "Y", remap: "y$" },
   *   { mode: "insert", keys: "jk", execute: () => [actions.modeChange("normal")] },
   * ], []);
   * ```
   */
  keybinds?: KeybindEntry[];
  /**
   * Custom ex commands (declarative).
   * Rebuilt only when the array reference changes.
   *
   * @example
   * ```ts
   * const commands = useMemo(() => [
   *   { name: "greet", execute: (args) => [actions.statusMessage("Hello " + args)] },
   * ], []);
   * ```
   */
  commands?: CommandEntry[];
}

/** Return value of the useVim hook */
export interface UseVimReturn {
  /** Current content */
  content: string;
  /** Current cursor position (0-based) */
  cursor: CursorPosition;
  /** Current Vim mode */
  mode: VimMode;
  /** Status bar message */
  statusMessage: string;
  /** Whether the status message is an error */
  statusError: boolean;
  /** Selection anchor for visual mode (null when not in visual) */
  visualAnchor: CursorPosition | null;
  /** Command-line display string (e.g. ":wq", "/pattern") */
  commandLine: string;
  /** Vim options set via :set commands */
  options: Record<string, boolean>;
  /** Last search pattern (for highlighting matches) */
  lastSearch: string;
  /**
   * Keyboard event handler.
   * Attach this to onKeyDown on a focusable element.
   */
  handleKeyDown: (e: React.KeyboardEvent) => void;
  /**
   * Scroll handler for Ctrl-U/D/B/F page scrolling.
   * @param direction - "up" or "down"
   * @param visibleLines - Number of visible lines in the viewport
   * @param amount - Fraction of the page to scroll (0.5 = half, 1.0 = full)
   */
  handleScroll: (direction: "up" | "down", visibleLines: number, amount?: number) => void;
  /**
   * Update the viewport information (for H/M/L motions).
   * Call this when the viewport scrolls or resizes.
   * @param topLine - First visible line (0-based)
   * @param height - Number of visible lines
   */
  updateViewport: (topLine: number, height: number) => void;
}

/**
 * Main hook for the vimee headless vim engine.
 *
 * Provides a complete Vim editing experience as React state.
 * TextBuffer is managed via ref (mutable, independent of rendering).
 * Display-related state (cursor, mode, content) triggers re-renders.
 *
 * @example
 * ```tsx
 * const { content, cursor, mode, handleKeyDown } = useVim({
 *   content: "Hello, vim!",
 *   onChange: (c) => console.log("Changed:", c),
 *   keybinds: [
 *     { mode: "normal", keys: "Y", remap: "y$" },
 *   ],
 *   commands: [
 *     { name: "greet", execute: (args) => [actions.statusMessage("Hello " + args)] },
 *   ],
 * });
 *
 * return (
 *   <div tabIndex={0} onKeyDown={handleKeyDown}>
 *     <pre>{content}</pre>
 *   </div>
 * );
 * ```
 */
export function useVim(options: UseVimOptions): UseVimReturn {
  const {
    content: initialContent,
    cursorPosition = "1:1",
    readOnly = false,
    onChange,
    onYank,
    onSave,
    onModeChange,
    onAction,
    indentStyle,
    indentWidth,
    keybinds,
    commands,
  } = options;

  // TextBuffer managed via ref (frequent mutations, no need for re-render)
  const bufferRef = useRef<TextBuffer>(new TextBuffer(initialContent));

  // VimContext managed via ref (parser intermediate state doesn't need rendering)
  const ctxRef = useRef<VimContext>(
    createInitialContext(parseCursorPosition(cursorPosition), {
      indentStyle,
      indentWidth,
    }),
  );

  // Stable map refs — bindings are swapped via replaceAll, refs never replaced
  const keybindMapRef = useRef<KeybindMap>(createKeybindMap());
  const commandMapRef = useRef<CommandMap>(createCommandMap());

  // Track previous prop references for lazy sync.
  // Use a symbol sentinel so the first syncMaps() call always triggers,
  // even when keybinds/commands are undefined.
  const UNINITIALIZED = useRef(Symbol("uninitialized")).current;
  const prevKeybindsRef = useRef<KeybindEntry[] | undefined | symbol>(UNINITIALIZED);
  const prevCommandsRef = useRef<CommandEntry[] | undefined | symbol>(UNINITIALIZED);

  // Display-related state
  const [content, setContent] = useState(initialContent);
  const [cursor, setCursor] = useState<CursorPosition>(parseCursorPosition(cursorPosition));
  const [mode, setMode] = useState<VimMode>("normal");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusError, setStatusError] = useState(false);
  const [visualAnchor, setVisualAnchor] = useState<CursorPosition | null>(null);
  const [commandLine, setCommandLine] = useState("");
  const [vimOptions, setVimOptions] = useState<Record<string, boolean>>({});

  /**
   * Sync keybinds/commands props to internal maps.
   * Only rebuilds when the array reference changes (lazy, no useEffect).
   */
  const syncMaps = useCallback(() => {
    if (prevKeybindsRef.current !== keybinds) {
      prevKeybindsRef.current = keybinds;
      keybindMapRef.current.replaceAll(
        (keybinds ?? []).map((kb) => ({
          mode: kb.mode,
          keys: kb.keys,
          definition: kb.remap != null ? { keys: kb.remap } : { execute: kb.execute! },
        })),
      );
    }
    if (prevCommandsRef.current !== commands) {
      prevCommandsRef.current = commands;
      commandMapRef.current.replaceAll(
        (commands ?? []).map((cmd) => ({
          name: cmd.name,
          definition: { execute: cmd.execute },
        })),
      );
    }
  }, [keybinds, commands]);

  /**
   * Process the action list and update React state and callbacks.
   */
  const processActions = useCallback(
    (actionList: VimAction[], newCtx: VimContext, key: string) => {
      for (const action of actionList) {
        onAction?.(action, key);

        switch (action.type) {
          case "cursor-move":
            setCursor(action.position);
            break;

          case "content-change":
            setContent(action.content);
            onChange?.(action.content);
            break;

          case "mode-change":
            setMode(action.mode);
            onModeChange?.(action.mode);
            break;

          case "yank":
            onYank?.(action.text);
            break;

          case "save":
            onSave?.(action.content);
            break;

          case "status-message":
            // statusMessage is synced from ctx below
            break;

          case "set-option":
            setVimOptions((prev) => ({
              ...prev,
              [action.option]: action.value,
            }));
            break;

          case "scroll":
            // Scroll is handled on the component side
            break;

          case "register-write":
            // Handled by core (ctx.registers updated), notify via onAction
            break;

          case "mark-set":
            // Handled by core (ctx.marks updated), notify via onAction
            break;

          case "quit":
            // Handled by host via onAction
            break;

          case "noop":
            break;
        }
      }

      // State that is always synced from VimContext
      setCursor(newCtx.cursor);
      setMode(newCtx.mode);
      setStatusMessage(newCtx.statusMessage);
      setStatusError(newCtx.statusError);
      setVisualAnchor(newCtx.visualAnchor);
      setCommandLine(newCtx.commandType ? newCtx.commandType + newCtx.commandBuffer : "");
    },
    [onChange, onYank, onSave, onModeChange, onAction],
  );

  /**
   * Keyboard event handler.
   * Receives a KeyboardEvent and passes it to the Vim engine.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Ignore during IME composition
      if (e.nativeEvent.isComposing) return;

      // Prevent browser default behavior for keys the vim engine handles
      if (shouldPreventDefault(e)) {
        e.preventDefault();
      }

      // Lazy sync: rebuild maps only when prop reference changes
      syncMaps();

      // Process the keystroke
      const { newCtx, actions: resultActions } = processKeystroke(
        e.key,
        ctxRef.current,
        bufferRef.current,
        e.ctrlKey,
        readOnly,
        keybindMapRef.current,
        commandMapRef.current,
      );

      // Update context
      ctxRef.current = newCtx;

      // Process actions
      processActions(resultActions, newCtx, e.key);
    },
    [readOnly, processActions, syncMaps],
  );

  /**
   * Scroll handler (for Ctrl-U/D/B/F).
   */
  const handleScroll = useCallback(
    (direction: "up" | "down", visibleLines: number, amount: number = 0.5) => {
      const scrollLines = Math.max(1, Math.floor(visibleLines * amount));
      const buffer = bufferRef.current;
      const ctx = ctxRef.current;

      const newLine =
        direction === "up"
          ? Math.max(0, ctx.cursor.line - scrollLines)
          : Math.min(buffer.getLineCount() - 1, ctx.cursor.line + scrollLines);

      const maxCol = Math.max(0, buffer.getLineLength(newLine) - 1);
      const newCursor = {
        line: newLine,
        col: Math.min(ctx.cursor.col, maxCol),
      };

      ctxRef.current = { ...ctx, cursor: newCursor };
      setCursor(newCursor);
    },
    [],
  );

  /**
   * Update the viewport information (called from the component on scroll/resize).
   */
  const updateViewport = useCallback((topLine: number, height: number) => {
    ctxRef.current = {
      ...ctxRef.current,
      viewportTopLine: topLine,
      viewportHeight: height,
    };
  }, []);

  return {
    content,
    cursor,
    mode,
    statusMessage,
    statusError,
    visualAnchor,
    commandLine,
    options: vimOptions,
    lastSearch: ctxRef.current.lastSearch,
    handleKeyDown,
    handleScroll,
    updateViewport,
  };
}

/**
 * Determine whether to prevent the browser's default behavior.
 *
 * To function as a Vim editor, the default behavior of the following keys must be prevented:
 * - Ctrl-R (browser reload -> Vim redo)
 * - Ctrl-D (add bookmark -> Vim half-page scroll down)
 * - Ctrl-U (view source -> Vim half-page scroll up)
 * - Tab (focus navigation -> indent)
 * - Escape (close dialog -> mode switch)
 * - / (quick search -> Vim search)
 */
function shouldPreventDefault(e: React.KeyboardEvent): boolean {
  // Ctrl key combinations
  if (e.ctrlKey) {
    const ctrlKeys = ["r", "b", "f", "d", "u", "v"];
    if (ctrlKeys.includes(e.key)) return true;
  }

  // Special keys
  if (e.key === "Tab" || e.key === "Escape") return true;

  // Search key (prevent browser quick search)
  if (e.key === "/") return true;

  return false;
}
