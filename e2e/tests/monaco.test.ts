import { expect, test } from "@playwright/test";

test.describe("monaco", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/src/monaco/index.html");
    await page.waitForSelector(".monaco-editor", { timeout: 10_000 });
    // Monaco's textarea is covered by overlays, use force click or click the editor view
    await page.click(".monaco-editor .view-lines", { force: true });
    // Reset cursor to start
    await page.keyboard.press("g");
    await page.keyboard.press("g");
  });

  test("starts in normal mode", async ({ page }) => {
    await expect(page.getByTestId("mode")).toHaveText("normal");
  });

  test("enters insert mode with i and returns to normal with Escape", async ({ page }) => {
    await page.keyboard.press("i");
    await expect(page.getByTestId("mode")).toHaveText("insert");

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("mode")).toHaveText("normal");
  });

  test("cursor moves with hjkl", async ({ page }) => {
    await page.keyboard.press("j");
    await page.keyboard.press("l");
    await page.keyboard.press("h");
    await page.keyboard.press("k");
    await expect(page.getByTestId("mode")).toHaveText("normal");
  });

  test("inserts text in insert mode", async ({ page }) => {
    await page.keyboard.press("i");
    await page.keyboard.type("abc");
    await page.keyboard.press("Escape");

    const content = await page.getByTestId("content").textContent();
    expect(content).toContain("abc");
  });

  test("deletes a line with dd", async ({ page }) => {
    const before = await page.getByTestId("content").textContent();
    const linesBefore = before!.split("\n").length;

    await page.keyboard.press("d");
    await page.keyboard.press("d");

    const after = await page.getByTestId("content").textContent();
    const linesAfter = after!.split("\n").length;
    expect(linesAfter).toBe(linesBefore - 1);
  });

  test("opens new line below with o", async ({ page }) => {
    await page.keyboard.press("o");
    await expect(page.getByTestId("mode")).toHaveText("insert");

    await page.keyboard.type("new line");
    await page.keyboard.press("Escape");

    const content = await page.getByTestId("content").textContent();
    expect(content).toContain("new line");
  });

  test("yanks and pastes a line with yy and p", async ({ page }) => {
    await page.keyboard.press("y");
    await page.keyboard.press("y");
    await page.keyboard.press("p");

    const content = await page.getByTestId("content").textContent();
    const lines = content!.split("\n");
    expect(lines[0]).toBe(lines[1]);
  });

  test("enters command-line mode with colon", async ({ page }) => {
    await page.keyboard.press(":");
    await expect(page.getByTestId("mode")).toHaveText("command-line");
  });

  test("a appends after cursor", async ({ page }) => {
    await page.keyboard.press("a");
    await expect(page.getByTestId("mode")).toHaveText("insert");
    await page.keyboard.type("Z");
    await page.keyboard.press("Escape");

    const content = await page.getByTestId("content").textContent();
    expect(content).toMatch(/^HZ/);
  });

  test("A appends at end of line", async ({ page }) => {
    await page.keyboard.press("A");
    await expect(page.getByTestId("mode")).toHaveText("insert");
    await page.keyboard.type("END");
    await page.keyboard.press("Escape");

    const content = await page.getByTestId("content").textContent();
    const firstLine = content!.split("\n")[0];
    expect(firstLine).toMatch(/END$/);
  });

  test("I inserts at beginning of line", async ({ page }) => {
    await page.keyboard.press("l");
    await page.keyboard.press("l");
    await page.keyboard.press("I");
    await expect(page.getByTestId("mode")).toHaveText("insert");
    await page.keyboard.type("START");
    await page.keyboard.press("Escape");

    const content = await page.getByTestId("content").textContent();
    expect(content).toMatch(/^START/);
  });

  test("O opens new line above", async ({ page }) => {
    await page.keyboard.press("j");
    await page.keyboard.press("O");
    await expect(page.getByTestId("mode")).toHaveText("insert");
    await page.keyboard.type("above");
    await page.keyboard.press("Escape");

    const content = await page.getByTestId("content").textContent();
    const lines = content!.split("\n");
    expect(lines[1]).toBe("above");
  });

  test("x deletes character at cursor", async ({ page }) => {
    await page.keyboard.press("x");

    const content = await page.getByTestId("content").textContent();
    expect(content).toMatch(/^ello, vimee!/);
  });

  test("D deletes to end of line", async ({ page }) => {
    await page.keyboard.press("l");
    await page.keyboard.press("D");

    const content = await page.getByTestId("content").textContent();
    const firstLine = content!.split("\n")[0];
    expect(firstLine).toBe("H");
  });

  test("cc changes entire line", async ({ page }) => {
    await page.keyboard.press("c");
    await page.keyboard.press("c");
    await expect(page.getByTestId("mode")).toHaveText("insert");
    await page.keyboard.type("replaced");
    await page.keyboard.press("Escape");

    const content = await page.getByTestId("content").textContent();
    const firstLine = content!.split("\n")[0];
    expect(firstLine).toBe("replaced");
  });

  test("u undoes last change", async ({ page }) => {
    const before = await page.getByTestId("content").textContent();

    await page.keyboard.press("d");
    await page.keyboard.press("d");

    const afterDelete = await page.getByTestId("content").textContent();
    expect(afterDelete).not.toBe(before);

    await page.keyboard.press("u");

    const afterUndo = await page.getByTestId("content").textContent();
    expect(afterUndo).toBe(before);
  });

  test("v enters visual mode", async ({ page }) => {
    await page.keyboard.press("v");
    await expect(page.getByTestId("mode")).toHaveText("visual");
  });

  test("V enters visual-line mode", async ({ page }) => {
    await page.keyboard.press("V");
    await expect(page.getByTestId("mode")).toHaveText("visual-line");
  });

  test("visual mode delete removes selected text", async ({ page }) => {
    await page.keyboard.press("v");
    await page.keyboard.press("l");
    await page.keyboard.press("l");
    await page.keyboard.press("l");
    await page.keyboard.press("l");
    await page.keyboard.press("d");

    await expect(page.getByTestId("mode")).toHaveText("normal");
    const content = await page.getByTestId("content").textContent();
    expect(content).toMatch(/^, vimee!/);
  });

  test("r replaces character under cursor", async ({ page }) => {
    await page.keyboard.press("r");
    await page.keyboard.press("Z");

    const content = await page.getByTestId("content").textContent();
    expect(content).toMatch(/^Zello/);
    await expect(page.getByTestId("mode")).toHaveText("normal");
  });

  test("J joins current line with next", async ({ page }) => {
    const before = await page.getByTestId("content").textContent();
    const linesBefore = before!.split("\n").length;

    await page.keyboard.press("J");

    const after = await page.getByTestId("content").textContent();
    const linesAfter = after!.split("\n").length;
    expect(linesAfter).toBe(linesBefore - 1);
    expect(after).toMatch(/vimee! This is/);
  });

  test("search with / finds text", async ({ page }) => {
    await page.keyboard.press("/");
    await expect(page.getByTestId("mode")).toHaveText("command-line");
    await page.keyboard.type("line 2");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("mode")).toHaveText("normal");
  });

  test("$ moves to end of line, 0 moves to start", async ({ page }) => {
    await page.keyboard.press("$");
    await page.keyboard.press("a");
    await page.keyboard.type("!");
    await page.keyboard.press("Escape");

    const content = await page.getByTestId("content").textContent();
    const firstLine = content!.split("\n")[0];
    expect(firstLine).toMatch(/!$/);

    await page.keyboard.press("0");
    await page.keyboard.press("i");
    await page.keyboard.type(">");
    await page.keyboard.press("Escape");

    const content2 = await page.getByTestId("content").textContent();
    expect(content2).toMatch(/^>/);
  });
});
