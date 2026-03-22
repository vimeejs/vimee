import { bench, describe } from "vitest";
import { TextBuffer } from "../buffer";
import { createInitialContext, processKeystroke } from "../vim-state";

const DOC = Array.from({ length: 100 }, (_, i) => `Line ${i}: const value = "hello world";`).join(
  "\n",
);

function freshState() {
  const buffer = new TextBuffer(DOC);
  const ctx = createInitialContext({ line: 0, col: 0 });
  return { buffer, ctx };
}

describe("processKeystroke - normal mode motions", () => {
  bench("h motion", () => {
    const { buffer, ctx } = freshState();
    const ctx1 = processKeystroke("l", ctx, buffer).newCtx;
    processKeystroke("h", ctx1, buffer);
  });

  bench("j motion", () => {
    const { buffer, ctx } = freshState();
    processKeystroke("j", ctx, buffer);
  });

  bench("w motion", () => {
    const { buffer, ctx } = freshState();
    processKeystroke("w", ctx, buffer);
  });

  bench("b motion", () => {
    const { buffer, ctx } = freshState();
    const ctx1 = processKeystroke("w", ctx, buffer).newCtx;
    processKeystroke("b", ctx1, buffer);
  });

  bench("$ motion", () => {
    const { buffer, ctx } = freshState();
    processKeystroke("$", ctx, buffer);
  });

  bench("gg motion", () => {
    const { buffer, ctx } = freshState();
    const ctx1 = processKeystroke("j", ctx, buffer).newCtx;
    const ctx2 = processKeystroke("g", ctx1, buffer).newCtx;
    processKeystroke("g", ctx2, buffer);
  });

  bench("G motion", () => {
    const { buffer, ctx } = freshState();
    processKeystroke("G", ctx, buffer);
  });
});

describe("processKeystroke - editing operations", () => {
  bench("x (delete char)", () => {
    const { buffer, ctx } = freshState();
    processKeystroke("x", ctx, buffer);
  });

  bench("dd (delete line)", () => {
    const { buffer, ctx } = freshState();
    const ctx1 = processKeystroke("d", ctx, buffer).newCtx;
    processKeystroke("d", ctx1, buffer);
  });

  bench("dw (delete word)", () => {
    const { buffer, ctx } = freshState();
    const ctx1 = processKeystroke("d", ctx, buffer).newCtx;
    processKeystroke("w", ctx1, buffer);
  });

  bench("yy (yank line)", () => {
    const { buffer, ctx } = freshState();
    const ctx1 = processKeystroke("y", ctx, buffer).newCtx;
    processKeystroke("y", ctx1, buffer);
  });
});

describe("processKeystroke - mode transitions", () => {
  bench("enter insert mode (i)", () => {
    const { buffer, ctx } = freshState();
    processKeystroke("i", ctx, buffer);
  });

  bench("insert and return to normal (i + Escape)", () => {
    const { buffer, ctx } = freshState();
    const ctx1 = processKeystroke("i", ctx, buffer).newCtx;
    processKeystroke("Escape", ctx1, buffer);
  });

  bench("enter visual mode (v)", () => {
    const { buffer, ctx } = freshState();
    processKeystroke("v", ctx, buffer);
  });

  bench("enter command-line mode (:)", () => {
    const { buffer, ctx } = freshState();
    processKeystroke(":", ctx, buffer);
  });
});

describe("processKeystroke - compound operations", () => {
  bench("ciw (change inner word)", () => {
    const { buffer, ctx } = freshState();
    const ctx1 = processKeystroke("c", ctx, buffer).newCtx;
    const ctx2 = processKeystroke("i", ctx1, buffer).newCtx;
    processKeystroke("w", ctx2, buffer);
  });

  bench("5j (counted motion)", () => {
    const { buffer, ctx } = freshState();
    const ctx1 = processKeystroke("5", ctx, buffer).newCtx;
    processKeystroke("j", ctx1, buffer);
  });

  bench("3dd (counted delete)", () => {
    const { buffer, ctx } = freshState();
    const ctx1 = processKeystroke("3", ctx, buffer).newCtx;
    const ctx2 = processKeystroke("d", ctx1, buffer).newCtx;
    processKeystroke("d", ctx2, buffer);
  });
});
