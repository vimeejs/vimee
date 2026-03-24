/**
 * command.test.ts
 *
 * Tests for the CommandMap class:
 * - addCommand / resolve / hasCommand
 * - Argument splitting
 * - replaceAll
 */

import { describe, it, expect } from "vitest";
import { createCommandMap } from "../command";
import type { CommandDefinition } from "../command";

const noop: CommandDefinition = { execute: () => [] };

describe("CommandMap", () => {
  describe("addCommand and resolve", () => {
    it("registers a command and resolves it", () => {
      const map = createCommandMap();
      map.addCommand("greet", noop);
      const result = map.resolve("greet");
      expect(result).not.toBeNull();
      expect(result!.args).toBe("");
      expect(result!.definition).toBe(noop);
    });

    it("returns null for unknown commands", () => {
      const map = createCommandMap();
      expect(map.resolve("unknown")).toBeNull();
    });

    it("splits name and args by first space", () => {
      const map = createCommandMap();
      map.addCommand("echo", noop);
      const result = map.resolve("echo hello world");
      expect(result).not.toBeNull();
      expect(result!.args).toBe("hello world");
    });

    it("returns empty string for args when no space", () => {
      const map = createCommandMap();
      map.addCommand("test", noop);
      const result = map.resolve("test");
      expect(result!.args).toBe("");
    });

    it("trims whitespace from input", () => {
      const map = createCommandMap();
      map.addCommand("cmd", noop);
      const result = map.resolve("  cmd  arg  ");
      expect(result).not.toBeNull();
      expect(result!.args).toBe("arg");
    });

    it("overwrites a command with the same name", () => {
      const map = createCommandMap();
      const def1: CommandDefinition = { execute: () => [{ type: "noop" }] };
      const def2: CommandDefinition = { execute: () => [{ type: "quit", force: false }] };
      map.addCommand("cmd", def1);
      map.addCommand("cmd", def2);
      const result = map.resolve("cmd");
      expect(result!.definition).toBe(def2);
    });
  });

  describe("hasCommand", () => {
    it("returns true for registered commands", () => {
      const map = createCommandMap();
      map.addCommand("greet", noop);
      expect(map.hasCommand("greet")).toBe(true);
    });

    it("returns false for unregistered commands", () => {
      const map = createCommandMap();
      expect(map.hasCommand("greet")).toBe(false);
    });
  });

  describe("replaceAll", () => {
    it("clears all commands and re-registers from array", () => {
      const map = createCommandMap();
      map.addCommand("old", noop);
      expect(map.hasCommand("old")).toBe(true);

      const newDef: CommandDefinition = { execute: () => [{ type: "noop" }] };
      map.replaceAll([{ name: "new", definition: newDef }]);

      expect(map.hasCommand("old")).toBe(false);
      expect(map.hasCommand("new")).toBe(true);
      expect(map.resolve("new")!.definition).toBe(newDef);
    });

    it("replaceAll with empty array clears all commands", () => {
      const map = createCommandMap();
      map.addCommand("cmd", noop);
      map.replaceAll([]);
      expect(map.hasCommand("cmd")).toBe(false);
    });
  });
});
