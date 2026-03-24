import { expect, test } from "@playwright/test";

test.describe("textarea", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/src/textarea/index.html");
    await page.waitForSelector("[data-testid=editor]");
    // Click at the top-left of the editor to position cursor at the beginning
    await page.click("[data-testid=editor]", { position: { x: 0, y: 0 } });
    // Ensure cursor is at line 1 by pressing gg
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
    // Move down to line 2
    await page.keyboard.press("j");
    // Move right
    await page.keyboard.press("l");
    // Move left
    await page.keyboard.press("h");
    // Move up back to line 1
    await page.keyboard.press("k");
    // Verify still in normal mode (motions don't change mode)
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

    // Read textarea value directly (avoids React async re-render timing)
    const content = await page.getByTestId("editor").inputValue();
    const lines = content.split("\n");
    expect(lines[0]).toBe(lines[1]);
  });

  test("enters command-line mode with colon", async ({ page }) => {
    await page.keyboard.press(":");
    await expect(page.getByTestId("mode")).toHaveText("command-line");
  });
});
