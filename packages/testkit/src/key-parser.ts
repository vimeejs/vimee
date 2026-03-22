/**
 * Key input: either a plain key string or an object with ctrlKey flag.
 */
export type KeyInput = string | { key: string; ctrlKey: true };

/**
 * Map of special key names to their KeyboardEvent.key values.
 */
const SPECIAL_KEYS: Record<string, string> = {
  Esc: "Escape",
  Enter: "Enter",
  CR: "Enter",
  BS: "Backspace",
  Tab: "Tab",
  Space: " ",
  Del: "Delete",
  Up: "ArrowUp",
  Down: "ArrowDown",
  Left: "ArrowLeft",
  Right: "ArrowRight",
};

/**
 * Parse a Vim-style key notation string into an array of key inputs.
 *
 * Supports:
 * - Plain characters: "dd" → ["d", "d"]
 * - Special keys: "<Esc>" → ["Escape"], "<Enter>" → ["Enter"]
 * - Ctrl combos: "<C-d>" → [{ key: "d", ctrlKey: true }]
 * - Mixed: "dd<C-r>" → ["d", "d", { key: "r", ctrlKey: true }]
 */
export function parseKeys(input: string): KeyInput[] {
  const result: KeyInput[] = [];
  let i = 0;

  while (i < input.length) {
    if (input[i] === "<") {
      const close = input.indexOf(">", i);
      if (close === -1) {
        // No closing bracket — treat as literal '<'
        result.push(input[i]);
        i++;
        continue;
      }

      const tag = input.slice(i + 1, close);

      if (tag.startsWith("C-") && tag.length === 3) {
        // Ctrl combination: <C-x> — normalize to lowercase
        result.push({ key: tag[2].toLowerCase(), ctrlKey: true });
      } else if (tag in SPECIAL_KEYS) {
        result.push(SPECIAL_KEYS[tag]);
      } else {
        // Unknown tag — push as-is
        result.push(tag);
      }

      i = close + 1;
    } else {
      result.push(input[i]);
      i++;
    }
  }

  return result;
}
