import { bench, describe } from "vitest";
import { TextBuffer } from "../buffer";
import { resolveMotion } from "../motion-resolver";

const CODE_DOC = `import { useState, useEffect } from "react";

interface Props {
  initialCount: number;
  onUpdate: (count: number) => void;
}

export function Counter({ initialCount, onUpdate }: Props) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    onUpdate(count);
  }, [count, onUpdate]);

  const increment = () => setCount((c) => c + 1);
  const decrement = () => setCount((c) => c - 1);

  return { count, increment, decrement };
}

function fibonacci(n: number): number {
  if (n < 2) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

const values = [1, 2, 3, 4, 5].map((x) => x * 2);
const filtered = values.filter((v) => v > 4);
`;

const buffer = new TextBuffer(CODE_DOC);
const midCursor = { line: 10, col: 15 };

describe("resolveMotion - character motions", () => {
  bench("h", () => {
    resolveMotion("h", midCursor, buffer, 1, true);
  });

  bench("l", () => {
    resolveMotion("l", midCursor, buffer, 1, true);
  });

  bench("j", () => {
    resolveMotion("j", midCursor, buffer, 1, true);
  });

  bench("k", () => {
    resolveMotion("k", midCursor, buffer, 1, true);
  });
});

describe("resolveMotion - word motions", () => {
  bench("w", () => {
    resolveMotion("w", midCursor, buffer, 1, true);
  });

  bench("b", () => {
    resolveMotion("b", midCursor, buffer, 1, true);
  });

  bench("e", () => {
    resolveMotion("e", midCursor, buffer, 1, true);
  });

  bench("W (WORD)", () => {
    resolveMotion("W", midCursor, buffer, 1, true);
  });

  bench("B (WORD back)", () => {
    resolveMotion("B", midCursor, buffer, 1, true);
  });
});

describe("resolveMotion - line motions", () => {
  bench("0 (line start)", () => {
    resolveMotion("0", midCursor, buffer, 1, true);
  });

  bench("$ (line end)", () => {
    resolveMotion("$", midCursor, buffer, 1, true);
  });

  bench("^ (first non-blank)", () => {
    resolveMotion("^", midCursor, buffer, 1, true);
  });
});

describe("resolveMotion - large jumps", () => {
  bench("G (end of file)", () => {
    resolveMotion("G", { line: 0, col: 0 }, buffer, 1, false);
  });

  bench("} (paragraph forward)", () => {
    resolveMotion("}", { line: 0, col: 0 }, buffer, 1, true);
  });

  bench("{ (paragraph backward)", () => {
    resolveMotion("{", { line: 20, col: 0 }, buffer, 1, true);
  });

  bench("% (match bracket)", () => {
    resolveMotion("%", { line: 8, col: 35 }, buffer, 1, true);
  });
});
