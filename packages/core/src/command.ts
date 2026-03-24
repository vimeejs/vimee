/**
 * command.ts
 *
 * Custom ex-command system for vimee.
 *
 * Provides:
 * - Command registration and lookup
 * - CommandMap class for managing user-defined : commands
 */

import type { VimContext, VimAction, BufferReader } from "./types";

// =====================
// Types
// =====================

/**
 * Callback-style command definition.
 * The execute function receives the argument string, a readonly context,
 * and a buffer reader, and returns an array of VimActions.
 */
export interface CommandDefinition {
  execute: (args: string, ctx: Readonly<VimContext>, buffer: BufferReader) => VimAction[];
}

// =====================
// CommandMap
// =====================

/**
 * Manages user-defined ex commands.
 *
 * Commands are matched by exact name. The first space in the input
 * separates the command name from its arguments.
 */
export class CommandMap {
  private commands: Map<string, CommandDefinition> = new Map();

  /**
   * Register a custom ex command.
   *
   * @param name - The command name (matched exactly, no abbreviations)
   * @param definition - Callback definition
   */
  addCommand(name: string, definition: CommandDefinition): void {
    this.commands.set(name, definition);
  }

  /**
   * Resolve a command input string.
   * Splits by the first space into name and args.
   *
   * @param input - The raw command string (without leading :)
   * @returns The matched definition and args, or null if not found
   */
  resolve(input: string): { definition: CommandDefinition; args: string } | null {
    const trimmed = input.trim();
    const spaceIdx = trimmed.indexOf(" ");
    const name = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
    const args = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1).trim();

    const definition = this.commands.get(name);
    if (!definition) return null;
    return { definition, args };
  }

  /** Check if a command is registered. */
  hasCommand(name: string): boolean {
    return this.commands.has(name);
  }

  /**
   * Clear all commands and re-register from an array.
   * Used by React hooks to sync declarative props to the map.
   */
  replaceAll(entries: Array<{ name: string; definition: CommandDefinition }>): void {
    this.commands.clear();
    for (const entry of entries) {
      this.commands.set(entry.name, entry.definition);
    }
  }
}

/**
 * Create a new empty CommandMap.
 */
export function createCommandMap(): CommandMap {
  return new CommandMap();
}
