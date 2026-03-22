import { describe, it, expect } from "vitest";
import { parseKeys } from "../key-parser";

describe("parseKeys", () => {
  describe("plain characters", () => {
    it("splits simple string into individual characters", () => {
      expect(parseKeys("dd")).toEqual(["d", "d"]);
    });

    it("handles single character", () => {
      expect(parseKeys("x")).toEqual(["x"]);
    });

    it("handles multi-character sequence", () => {
      expect(parseKeys("ciw")).toEqual(["c", "i", "w"]);
    });

    it("handles digits", () => {
      expect(parseKeys("3j")).toEqual(["3", "j"]);
    });
  });

  describe("special keys", () => {
    it("parses <Esc>", () => {
      expect(parseKeys("<Esc>")).toEqual(["Escape"]);
    });

    it("parses <Enter>", () => {
      expect(parseKeys("<Enter>")).toEqual(["Enter"]);
    });

    it("parses <CR> as Enter", () => {
      expect(parseKeys("<CR>")).toEqual(["Enter"]);
    });

    it("parses <BS> as Backspace", () => {
      expect(parseKeys("<BS>")).toEqual(["Backspace"]);
    });

    it("parses <Tab>", () => {
      expect(parseKeys("<Tab>")).toEqual(["Tab"]);
    });

    it("parses <Space>", () => {
      expect(parseKeys("<Space>")).toEqual([" "]);
    });

    it("parses <Del>", () => {
      expect(parseKeys("<Del>")).toEqual(["Delete"]);
    });
  });

  describe("Ctrl combinations", () => {
    it("parses <C-d>", () => {
      expect(parseKeys("<C-d>")).toEqual([{ key: "d", ctrlKey: true }]);
    });

    it("parses <C-u>", () => {
      expect(parseKeys("<C-u>")).toEqual([{ key: "u", ctrlKey: true }]);
    });

    it("parses <C-r>", () => {
      expect(parseKeys("<C-r>")).toEqual([{ key: "r", ctrlKey: true }]);
    });

    it("parses <C-v>", () => {
      expect(parseKeys("<C-v>")).toEqual([{ key: "v", ctrlKey: true }]);
    });

    it("normalizes uppercase <C-D> to lowercase key", () => {
      expect(parseKeys("<C-D>")).toEqual([{ key: "d", ctrlKey: true }]);
    });
  });

  describe("arrow keys", () => {
    it("parses <Up>", () => {
      expect(parseKeys("<Up>")).toEqual(["ArrowUp"]);
    });

    it("parses <Down>", () => {
      expect(parseKeys("<Down>")).toEqual(["ArrowDown"]);
    });

    it("parses <Left>", () => {
      expect(parseKeys("<Left>")).toEqual(["ArrowLeft"]);
    });

    it("parses <Right>", () => {
      expect(parseKeys("<Right>")).toEqual(["ArrowRight"]);
    });
  });

  describe("mixed sequences", () => {
    it("handles plain + special", () => {
      expect(parseKeys("dd<C-r>")).toEqual([
        "d",
        "d",
        { key: "r", ctrlKey: true },
      ]);
    });

    it("handles special + plain", () => {
      expect(parseKeys("<Esc>j")).toEqual(["Escape", "j"]);
    });

    it("handles multiple specials", () => {
      expect(parseKeys("<C-d><C-d>")).toEqual([
        { key: "d", ctrlKey: true },
        { key: "d", ctrlKey: true },
      ]);
    });

    it("handles sequence ending with Escape", () => {
      expect(parseKeys("ciwfoo<Esc>")).toEqual([
        "c",
        "i",
        "w",
        "f",
        "o",
        "o",
        "Escape",
      ]);
    });
  });

  describe("empty input", () => {
    it("returns empty array for empty string", () => {
      expect(parseKeys("")).toEqual([]);
    });
  });
});
