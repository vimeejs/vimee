/**
 * vim-state.ts
 *
 * Core of Vim state management.
 * Initializes state and dispatches keystrokes to the appropriate mode handler.
 *
 * Each mode's processing is split into its own file:
 * - normal-mode.ts: Normal mode
 * - insert-mode.ts: Insert mode
 * - visual-mode.ts: Visual mode
 * - command-line-mode.ts: Command-line mode (:, /, ?)
 */

import type { CursorPosition, VimContext, VimAction } from "./types";
import type { TextBuffer } from "./buffer";
import type { KeystrokeResult } from "./key-utils";
import { processNormalMode } from "./normal-mode";
import { processInsertMode } from "./insert-mode";
import { processVisualMode } from "./visual-mode";
import { processCommandLineMode } from "./command-line-mode";
import type { KeybindMap, KeybindCallbackDefinition } from "./keybind";
import { parseKeySequence } from "./keybind";
import type { CommandMap } from "./command";
import { applyUserActions } from "./apply-actions";

export type { KeystrokeResult } from "./key-utils";

/** Modifier-only keys that should be ignored */
const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta"]);

function isModifierKey(key: string): boolean {
  return MODIFIER_KEYS.has(key);
}

/**
 * Generate the initial VimContext value.
 * Called once when the component mounts.
 */
export function createInitialContext(
  cursor: CursorPosition,
  opts?: { indentStyle?: "space" | "tab"; indentWidth?: number },
): VimContext {
  return {
    mode: "normal",
    phase: "idle",
    count: 0,
    operator: null,
    cursor,
    visualAnchor: null,
    register: "",
    registers: {},
    selectedRegister: null,
    commandBuffer: "",
    commandType: null,
    lastSearch: "",
    searchDirection: "forward",
    charCommand: null,
    lastCharSearch: null,
    textObjectModifier: null,
    lastChange: [],
    pendingChange: [],
    marks: {},
    macroRecording: null,
    macros: {},
    lastMacro: null,
    blockInsert: null,
    statusMessage: "",
    statusError: false,
    indentStyle: opts?.indentStyle ?? "space",
    indentWidth: opts?.indentWidth ?? 2,
    viewportTopLine: 0,
    viewportHeight: 50,
  };
}

/**
 * Parse a cursor position string ("1:1" format, 1-based)
 * into an internal 0-based CursorPosition.
 */
export function parseCursorPosition(pos: string): CursorPosition {
  const parts = pos.split(":");
  const line = Math.max(0, (Number.parseInt(parts[0], 10) || 1) - 1);
  const col = Math.max(0, (Number.parseInt(parts[1], 10) || 1) - 1);
  return { line, col };
}

/**
 * Main keystroke processing dispatcher.
 *
 * Delegates processing to the corresponding mode handler based on the current mode.
 * Each mode handler returns a new context and a list of actions.
 *
 * @param key - The value of KeyboardEvent.key
 * @param ctx - The current Vim context
 * @param buffer - The text buffer
 * @param ctrlKey - Whether the Ctrl key is pressed
 * @param readOnly - Read-only mode
 * @param keybinds - Optional custom keybind map (highest priority)
 * @param commands - Optional custom command map for : commands
 */
export function processKeystroke(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
  ctrlKey: boolean = false,
  readOnly: boolean = false,
  keybinds?: KeybindMap,
  commands?: CommandMap,
): KeystrokeResult {
  // Ignore modifier-only keys (Shift, Control, Alt, Meta).
  // These fire as separate keydown events and must not reset state (e.g. count).
  if (isModifierKey(key)) {
    return { newCtx: ctx, actions: [] };
  }

  // --- Custom keybind resolution (highest priority) ---
  if (keybinds) {
    // Escape cancels pending keybind sequence
    if (key === "Escape" && keybinds.isPending()) {
      keybinds.cancel();
      return { newCtx: ctx, actions: [] };
    }

    const resolved = keybinds.resolve(key, ctx.mode, ctrlKey);

    switch (resolved.status) {
      case "matched": {
        if ("execute" in resolved.definition) {
          return executeKeybindCallback(resolved.definition, ctx, buffer);
        }
        // Remap: replay the target key sequence through the engine
        return executeKeybindRemap(resolved.definition.keys, ctx, buffer, readOnly);
      }
      case "pending":
        return {
          newCtx: { ...ctx, statusMessage: resolved.display },
          actions: [],
        };
      // "none" → fall through to normal processing
    }
  }

  // --- Macro: stop recording with q in normal mode ---
  if (ctx.macroRecording && key === "q" && ctx.mode === "normal" && ctx.phase === "idle") {
    return stopMacroRecording(ctx);
  }

  // --- Macro: start recording with q{a-z} ---
  if (key === "q" && ctx.mode === "normal" && ctx.phase === "idle" && !ctx.macroRecording) {
    return {
      newCtx: { ...ctx, phase: "macro-register-pending" },
      actions: [],
    };
  }
  if (ctx.phase === "macro-register-pending") {
    return startMacroRecording(key, ctx);
  }

  // --- Macro: execute with @{a-z} or @@ ---
  if (key === "@" && ctx.mode === "normal" && ctx.phase === "idle" && !ctx.macroRecording) {
    return {
      newCtx: { ...ctx, phase: "macro-execute-pending" },
      actions: [],
    };
  }
  if (ctx.phase === "macro-execute-pending") {
    return executeMacro(key, ctx, buffer, readOnly, commands);
  }

  // --- Dot repeat: replay the last change ---
  if (key === "." && ctx.mode === "normal" && ctx.phase === "idle" && ctx.lastChange.length > 0) {
    const result = replayLastChange(ctx, buffer, readOnly, commands);
    return maybeCaptureKey(key, ctx, result);
  }

  const result = processKeystrokeInner(key, ctx, buffer, ctrlKey, readOnly, commands);
  const tracked = trackChange(key, ctx, result);
  return maybeCaptureKey(key, ctx, tracked);
}

/**
 * Inner keystroke dispatcher (without change tracking).
 */
function processKeystrokeInner(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
  ctrlKey: boolean,
  readOnly: boolean,
  commands?: CommandMap,
): KeystrokeResult {
  switch (ctx.mode) {
    case "normal":
      return processNormalMode(key, ctx, buffer, ctrlKey, readOnly);
    case "insert":
      // readOnly: should not reach insert mode, but force return to normal mode as a safety measure
      if (readOnly) {
        return {
          newCtx: {
            ...ctx,
            mode: "normal",
            phase: "idle",
            count: 0,
            operator: null,
            statusMessage: "",
          },
          actions: [{ type: "mode-change", mode: "normal" }],
        };
      }
      return processInsertMode(key, ctx, buffer, ctrlKey);
    case "visual":
    case "visual-line":
    case "visual-block":
      return processVisualMode(key, ctx, buffer, ctrlKey, readOnly);
    case "command-line":
      return processCommandLineMode(key, ctx, buffer, commands);
    default:
      return { newCtx: ctx, actions: [] };
  }
}

/**
 * Track change key sequences for dot-repeat.
 *
 * A "change" starts when:
 * - An operator is started (d, c) or a mutating command is pressed (x, ~, etc.)
 * - Insert mode is entered
 *
 * A "change" ends when:
 * - We return to normal mode idle after a buffer mutation
 *
 * During a change, all keys are accumulated in pendingChange.
 * When complete, pendingChange is saved to lastChange.
 */
function trackChange(key: string, prevCtx: VimContext, result: KeystrokeResult): KeystrokeResult {
  const newCtx = result.newCtx;
  const hasContentChange = result.actions.some((a) => a.type === "content-change");

  const wasInChange = prevCtx.pendingChange.length > 0;
  const prevWasNormal = prevCtx.mode === "normal";
  const nowNormalIdle = newCtx.mode === "normal" && newCtx.phase === "idle";
  const enteredInsert = newCtx.mode === "insert" && prevCtx.mode !== "insert";
  const enteredOperatorPending = newCtx.phase === "operator-pending" && prevCtx.phase === "idle";
  const enteredCharPending = newCtx.phase === "char-pending" && prevCtx.phase !== "char-pending";
  const enteredTextObjectPending =
    newCtx.phase === "text-object-pending" && prevCtx.phase !== "text-object-pending";

  // In insert mode, keep accumulating
  if (prevCtx.mode === "insert" && newCtx.mode === "insert") {
    return {
      ...result,
      newCtx: {
        ...newCtx,
        pendingChange: [...newCtx.pendingChange, key],
      },
    };
  }

  // Returning from insert to normal -> change complete
  if (prevCtx.mode === "insert" && nowNormalIdle) {
    const change = [...prevCtx.pendingChange, key];
    return {
      ...result,
      newCtx: {
        ...newCtx,
        lastChange: change,
        pendingChange: [],
      },
    };
  }

  // Starting a change from normal: operator, char-pending, or entering insert
  if (prevWasNormal && (enteredOperatorPending || enteredCharPending || enteredInsert)) {
    // If already accumulating (e.g., ciw enters insert from operator-pending),
    // keep the existing pendingChange
    const pending = wasInChange ? [...prevCtx.pendingChange, key] : [key];
    return {
      ...result,
      newCtx: {
        ...newCtx,
        pendingChange: pending,
      },
    };
  }

  // Accumulating in operator-pending / char-pending / text-object-pending
  if (wasInChange && !nowNormalIdle) {
    return {
      ...result,
      newCtx: {
        ...newCtx,
        pendingChange: [...prevCtx.pendingChange, key],
      },
    };
  }

  // Change completed in one step from pending state back to normal
  if (wasInChange && nowNormalIdle) {
    const change = [...prevCtx.pendingChange, key];
    // Only save if there was an actual content change
    if (hasContentChange) {
      return {
        ...result,
        newCtx: {
          ...newCtx,
          lastChange: change,
          pendingChange: [],
        },
      };
    }
    // No content change (e.g., yy) -> discard pending
    return {
      ...result,
      newCtx: {
        ...newCtx,
        pendingChange: [],
      },
    };
  }

  // Immediate single-key change (x, ~, J, p, P, D)
  if (prevWasNormal && nowNormalIdle && hasContentChange) {
    // Include any count keys that were accumulated
    const countKeys = prevCtx.count > 0 ? String(prevCtx.count).split("") : [];
    return {
      ...result,
      newCtx: {
        ...newCtx,
        lastChange: [...countKeys, key],
        pendingChange: [],
      },
    };
  }

  return result;
}

/**
 * Replay the last change key sequence.
 */
function replayLastChange(
  ctx: VimContext,
  buffer: TextBuffer,
  readOnly: boolean,
  commands?: CommandMap,
): KeystrokeResult {
  let current = { ...ctx, pendingChange: [] as string[] };
  const allActions: import("./types").VimAction[] = [];

  for (const k of ctx.lastChange) {
    const ctrlKey = false; // TODO: handle Ctrl in replay if needed
    const inner = processKeystrokeInner(k, current, buffer, ctrlKey, readOnly, commands);
    current = inner.newCtx;
    allActions.push(...inner.actions);
  }

  // Preserve lastChange (don't overwrite with the replay)
  current.lastChange = ctx.lastChange;
  current.pendingChange = [];

  return {
    newCtx: current,
    actions: allActions,
  };
}

// =====================
// Macro recording & playback
// =====================

/**
 * Capture the key into the macro recording buffer if recording.
 */
function maybeCaptureKey(
  key: string,
  prevCtx: VimContext,
  result: KeystrokeResult,
): KeystrokeResult {
  if (!prevCtx.macroRecording) return result;

  // Don't record the q that starts recording (it's already handled before this)
  // Keys during recording are captured into macros[register]
  const reg = prevCtx.macroRecording;
  const existing = result.newCtx.macros[reg] ?? [];
  const recordingStatus = `recording @${reg}`;
  // Preserve "recording @x" in status line unless there's a more important message
  const statusMessage =
    result.newCtx.statusMessage &&
    result.newCtx.statusMessage !== "" &&
    result.newCtx.statusMessage !== recordingStatus
      ? result.newCtx.statusMessage
      : recordingStatus;

  return {
    ...result,
    newCtx: {
      ...result.newCtx,
      macros: {
        ...result.newCtx.macros,
        [reg]: [...existing, key],
      },
      macroRecording: reg,
      statusMessage,
    },
  };
}

/**
 * Start recording a macro into the given register.
 */
function startMacroRecording(key: string, ctx: VimContext): KeystrokeResult {
  if (/^[a-z]$/.test(key)) {
    return {
      newCtx: {
        ...ctx,
        phase: "idle",
        macroRecording: key,
        macros: { ...ctx.macros, [key]: [] },
        statusMessage: `recording @${key}`,
      },
      actions: [],
    };
  }
  // Invalid register -> cancel
  return {
    newCtx: { ...ctx, phase: "idle" },
    actions: [],
  };
}

/**
 * Stop recording the current macro.
 */
function stopMacroRecording(ctx: VimContext): KeystrokeResult {
  return {
    newCtx: {
      ...ctx,
      macroRecording: null,
      statusMessage: "",
    },
    actions: [],
  };
}

/**
 * Execute a macro from a register, or @@ to repeat the last macro.
 */
function executeMacro(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
  readOnly: boolean,
  commands?: CommandMap,
): KeystrokeResult {
  let reg: string | null = null;

  if (key === "@" && ctx.lastMacro) {
    reg = ctx.lastMacro;
  } else if (/^[a-z]$/.test(key)) {
    reg = key;
  }

  if (!reg || !ctx.macros[reg] || ctx.macros[reg].length === 0) {
    return {
      newCtx: { ...ctx, phase: "idle" },
      actions: [],
    };
  }

  const keys = ctx.macros[reg];
  let current: VimContext = { ...ctx, phase: "idle", lastMacro: reg };
  const allActions: import("./types").VimAction[] = [];

  for (const k of keys) {
    const inner = processKeystrokeInner(k, current, buffer, false, readOnly, commands);
    // Apply change tracking
    const tracked = trackChange(k, current, inner);
    current = tracked.newCtx;
    allActions.push(...tracked.actions);
  }

  // Preserve macro state
  current.lastMacro = reg;

  return {
    newCtx: current,
    actions: allActions,
  };
}

// =====================
// Custom keybind execution
// =====================

/**
 * Execute a callback-style keybind and apply the returned actions to the context.
 */
function executeKeybindCallback(
  definition: KeybindCallbackDefinition,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  const userActions = definition.execute(ctx, buffer);
  return applyUserActions(userActions, ctx, buffer);
}

/**
 * Execute a remap-style keybind by replaying the target key sequence.
 */
function executeKeybindRemap(
  targetKeys: string,
  ctx: VimContext,
  buffer: TextBuffer,
  readOnly: boolean,
): KeystrokeResult {
  const tokens = parseKeySequence(targetKeys);

  let current = ctx;
  const allActions: VimAction[] = [];

  for (const k of tokens) {
    // Convert special key tokens back to KeyboardEvent.key format
    const { eventKey, ctrl } = tokenToEventKey(k);
    const inner = processKeystrokeInner(eventKey, current, buffer, ctrl, readOnly);
    const tracked = trackChange(eventKey, current, inner);
    current = tracked.newCtx;
    allActions.push(...tracked.actions);
  }

  return { newCtx: current, actions: allActions };
}

/**
 * Convert a key token (e.g., "<C-r>", "<Esc>", "a") back to
 * the format expected by processKeystrokeInner (KeyboardEvent.key + ctrlKey).
 */
function tokenToEventKey(token: string): { eventKey: string; ctrl: boolean } {
  const ctrlMatch = token.match(/^<C-([a-z])>$/);
  if (ctrlMatch) {
    return { eventKey: ctrlMatch[1], ctrl: true };
  }
  switch (token) {
    case "<Esc>":
      return { eventKey: "Escape", ctrl: false };
    case "<CR>":
      return { eventKey: "Enter", ctrl: false };
    case "<Tab>":
      return { eventKey: "Tab", ctrl: false };
    case "<BS>":
      return { eventKey: "Backspace", ctrl: false };
    case "<Del>":
      return { eventKey: "Delete", ctrl: false };
    case "<Space>":
      return { eventKey: " ", ctrl: false };
    default:
      return { eventKey: token, ctrl: false };
  }
}
