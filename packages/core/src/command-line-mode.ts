/**
 * command-line-mode.ts
 *
 * Command-line mode processing.
 * Handles command input initiated by :, /, or ?.
 *
 * Supported commands:
 * - :w -> Save (invokes onSave callback)
 * - /pattern -> Forward search
 * - ?pattern -> Backward search
 *
 * TODO:
 * - :q -> Quit
 * - :wq -> Save and quit
 * - :{number} -> Jump to specified line
 * - :s/old/new/ -> Substitution
 */

import type { VimContext, VimAction } from "./types";
import type { TextBuffer } from "./buffer";
import type { KeystrokeResult } from "./key-utils";
import { searchInBuffer } from "./search";

/**
 * Main handler for command-line mode.
 */
export function processCommandLineMode(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  // --- Escape -> return to normal mode ---
  if (key === "Escape") {
    return exitCommandLine(ctx);
  }

  // --- Enter -> execute command ---
  if (key === "Enter") {
    return executeCommand(ctx, buffer);
  }

  // --- Backspace ---
  if (key === "Backspace") {
    return handleBackspace(ctx);
  }

  // --- Character input ---
  if (key.length === 1) {
    return appendChar(key, ctx);
  }

  return { newCtx: ctx, actions: [] };
}

/**
 * Exit command-line mode.
 */
function exitCommandLine(ctx: VimContext): KeystrokeResult {
  return {
    newCtx: {
      ...ctx,
      mode: "normal",
      commandBuffer: "",
      commandType: null,
      statusMessage: "",
      statusError: false,
    },
    actions: [{ type: "mode-change", mode: "normal" }],
  };
}

/**
 * Enter: Execute the command.
 * Execution behavior depends on the commandType.
 */
function executeCommand(ctx: VimContext, buffer: TextBuffer): KeystrokeResult {
  const cmd = ctx.commandBuffer;

  if (ctx.commandType === ":") {
    return executeExCommand(cmd, ctx, buffer);
  }

  if (ctx.commandType === "/" || ctx.commandType === "?") {
    return executeSearch(cmd, ctx, buffer);
  }

  return exitCommandLine(ctx);
}

/**
 * Execute an Ex command (a command starting with :).
 */
function executeExCommand(cmd: string, ctx: VimContext, buffer: TextBuffer): KeystrokeResult {
  const actions: VimAction[] = [];

  switch (cmd.trim()) {
    case "w":
      // :w -> save
      actions.push({ type: "save", content: buffer.getContent() });
      break;

    case "set number":
    case "set nu":
      actions.push({ type: "set-option", option: "number", value: true });
      break;

    case "set nonumber":
    case "set nonu":
      actions.push({ type: "set-option", option: "number", value: false });
      break;

    default: {
      // Substitution: [range]s/old/new/[g]
      const subResult = trySubstitute(cmd.trim(), ctx, buffer);
      if (subResult) return subResult;

      // If numeric, jump to that line
      const lineNum = Number.parseInt(cmd.trim(), 10);
      if (!Number.isNaN(lineNum)) {
        const targetLine = Math.max(0, Math.min(lineNum - 1, buffer.getLineCount() - 1));
        const newCursor = { line: targetLine, col: 0 };
        return {
          newCtx: {
            ...ctx,
            mode: "normal",
            commandBuffer: "",
            commandType: null,
            cursor: newCursor,
            statusMessage: "",
            statusError: false,
          },
          actions: [
            { type: "mode-change", mode: "normal" },
            { type: "cursor-move", position: newCursor },
          ],
        };
      }

      // Unknown command
      return {
        newCtx: {
          ...ctx,
          mode: "normal",
          commandBuffer: "",
          commandType: null,
          statusMessage: `E492: Not an editor command: ${cmd.trim()}`,
          statusError: true,
        },
        actions: [
          { type: "mode-change", mode: "normal" },
          { type: "status-message", message: `E492: Not an editor command: ${cmd.trim()}` },
        ],
      };
    }
  }

  return {
    newCtx: {
      ...ctx,
      mode: "normal",
      commandBuffer: "",
      commandType: null,
      statusMessage: "",
    },
    actions: [{ type: "mode-change", mode: "normal" }, ...actions],
  };
}

/**
 * Execute a search command (/ or ?).
 */
function executeSearch(pattern: string, ctx: VimContext, buffer: TextBuffer): KeystrokeResult {
  if (!pattern) {
    return exitCommandLine(ctx);
  }

  const direction = ctx.commandType === "/" ? "forward" : "backward";

  const found = searchInBuffer(buffer, pattern, ctx.cursor, direction as "forward" | "backward");

  if (found) {
    return {
      newCtx: {
        ...ctx,
        mode: "normal",
        commandBuffer: "",
        commandType: null,
        lastSearch: pattern,
        searchDirection: direction as "forward" | "backward",
        cursor: found,
        statusMessage: "",
      },
      actions: [
        { type: "mode-change", mode: "normal" },
        { type: "cursor-move", position: found },
      ],
    };
  }

  // Pattern not found
  return {
    newCtx: {
      ...ctx,
      mode: "normal",
      commandBuffer: "",
      commandType: null,
      lastSearch: pattern,
      searchDirection: direction as "forward" | "backward",
      statusMessage: `Pattern not found: ${pattern}`,
    },
    actions: [
      { type: "mode-change", mode: "normal" },
      { type: "status-message", message: `Pattern not found: ${pattern}` },
    ],
  };
}

/**
 * Try to parse and execute a substitute command.
 * Formats:
 *   s/old/new/[g]       - current line
 *   %s/old/new/[g]      - all lines
 *   N,Ms/old/new/[g]    - line range (1-based)
 *   .,$s/old/new/[g]    - current line to end
 */
function trySubstitute(cmd: string, ctx: VimContext, buffer: TextBuffer): KeystrokeResult | null {
  // Parse: optional range + s + delimiter + pattern + delimiter + replacement + optional(delimiter + flags)
  const match = cmd.match(/^(%|(\d+|\.)?,?(\d+|\$)?)?s(.)(.+?)\4(.*?)(?:\4([gi]*))?$/);
  if (!match) return null;

  const [, rangeStr, rangeStart, rangeEnd, , pattern, replacement, flags = ""] = match;
  const globalFlag = flags.includes("g");
  const caseInsensitive = flags.includes("i");

  // Resolve line range
  let startLine: number;
  let endLine: number;

  if (rangeStr === "%") {
    startLine = 0;
    endLine = buffer.getLineCount() - 1;
  } else if (rangeStart !== undefined || rangeEnd !== undefined) {
    startLine = resolveLineRef(rangeStart, ctx.cursor.line, buffer);
    endLine =
      rangeEnd !== undefined ? resolveLineRef(rangeEnd, ctx.cursor.line, buffer) : startLine;
  } else {
    // No range: current line only
    startLine = ctx.cursor.line;
    endLine = ctx.cursor.line;
  }

  startLine = Math.max(0, Math.min(startLine, buffer.getLineCount() - 1));
  endLine = Math.max(startLine, Math.min(endLine, buffer.getLineCount() - 1));

  // Build regex
  let regex: RegExp;
  try {
    const regexFlags = (globalFlag ? "g" : "") + (caseInsensitive ? "i" : "");
    regex = new RegExp(pattern, regexFlags);
  } catch {
    return {
      newCtx: {
        ...ctx,
        mode: "normal",
        commandBuffer: "",
        commandType: null,
        statusMessage: `Invalid pattern: ${pattern}`,
      },
      actions: [{ type: "mode-change", mode: "normal" }],
    };
  }

  // Execute substitution
  buffer.saveUndoPoint(ctx.cursor);
  let totalReplacements = 0;
  let linesChanged = 0;

  for (let l = startLine; l <= endLine; l++) {
    const original = buffer.getLine(l);
    const replaced = original.replace(regex, replacement);
    if (replaced !== original) {
      buffer.setLine(l, replaced);
      linesChanged++;
      // Count individual replacements
      if (globalFlag) {
        const matches = original.match(new RegExp(pattern, "g" + (caseInsensitive ? "i" : "")));
        totalReplacements += matches ? matches.length : 0;
      } else {
        totalReplacements++;
      }
    }
  }

  const statusMessage =
    totalReplacements > 0
      ? `${totalReplacements} substitution${totalReplacements > 1 ? "s" : ""} on ${linesChanged} line${linesChanged > 1 ? "s" : ""}`
      : "Pattern not found: " + pattern;

  return {
    newCtx: {
      ...ctx,
      mode: "normal",
      commandBuffer: "",
      commandType: null,
      statusMessage,
    },
    actions: [
      { type: "mode-change", mode: "normal" },
      ...(totalReplacements > 0
        ? [{ type: "content-change" as const, content: buffer.getContent() }]
        : []),
    ],
  };
}

/**
 * Resolve a line reference (number, '.', '$') to a 0-based line index.
 */
function resolveLineRef(ref: string | undefined, currentLine: number, buffer: TextBuffer): number {
  if (!ref || ref === ".") return currentLine;
  if (ref === "$") return buffer.getLineCount() - 1;
  return Math.max(0, Number.parseInt(ref, 10) - 1);
}

/**
 * Backspace: Delete one character from the command buffer.
 * If the buffer is empty, exit command-line mode.
 */
function handleBackspace(ctx: VimContext): KeystrokeResult {
  if (ctx.commandBuffer.length === 0) {
    return exitCommandLine(ctx);
  }

  const newBuffer = ctx.commandBuffer.slice(0, -1);
  return {
    newCtx: {
      ...ctx,
      commandBuffer: newBuffer,
      statusMessage: (ctx.commandType ?? "") + newBuffer,
    },
    actions: [],
  };
}

/**
 * Append one character to the command buffer.
 */
function appendChar(key: string, ctx: VimContext): KeystrokeResult {
  const newBuffer = ctx.commandBuffer + key;
  return {
    newCtx: {
      ...ctx,
      commandBuffer: newBuffer,
      statusMessage: (ctx.commandType ?? "") + newBuffer,
    },
    actions: [],
  };
}
