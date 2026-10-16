import { expect, test } from "@playwright/test";

test("project descriptions follow every preview in both directions and after reload/resize", async ({ page }) => {
  await page.goto("/");
  const previews = page.locator("#projects .lg\\:flex").first().locator("[data-project-preview]");
  const title = page.locator("#projects .swap h3");
  const names = ["Polybot", "Airline Intelligence", "BravOS", "AppliedLoop", "This Portfolio"];
  for (const i of [0, 1, 2, 3, 4, 3, 2, 1, 0]) {
    await previews.nth(i).evaluate(el => el.scrollIntoView({ block: "center", behavior: "instant" }));
    await expect(title).toHaveText(names[i]);
  }
  await previews.nth(3).evaluate(el => el.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.reload();
  await expect(title).toHaveText("AppliedLoop");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#projects article")).toHaveCount(5);
  await page.setViewportSize({ width: 1440, height: 900 });
  await previews.nth(4).evaluate(el => el.scrollIntoView({ block: "center", behavior: "instant" }));
  await expect(title).toHaveText("This Portfolio");
});

test("entrance animations run without IntersectionObserver and leave content visible", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "IntersectionObserver", { value: undefined });
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      if (this.classList.contains("reveal")) this.setAttribute("data-entrance-played", "true");
      return animate.apply(this, args);
    };
  });
  await page.goto("/");
  for (const selector of ["#about", "#connect"]) {
    await page.locator(selector).evaluate(el => el.scrollIntoView({ behavior: "instant", block: "start" }));
    const blocks = page.locator(`${selector} .reveal`);
    // Scroll each block, including the tall tech stack, into view.
    for (const block of await blocks.all()) {
      await block.evaluate(el => el.scrollIntoView({ behavior: "instant", block: "center" }));
      await expect(block).toHaveAttribute("data-entrance-played", "true");
      await expect(block).toHaveCSS("opacity", "1");
    }
  }
});

test("content stays visible without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://localhost:3000/");
  for (const block of await page.locator("#about .reveal, #connect .reveal").all()) {
    await expect(block).toHaveCSS("opacity", "1");
  }
  await context.close();
});

test("reduced motion skips entrances and mobile sections remain visible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator("#connect").evaluate(el => el.scrollIntoView({ behavior: "instant" }));
  for (const block of await page.locator("#about .reveal, #connect .reveal").all()) {
    await expect(block).toHaveCSS("opacity", "1");
    expect(await block.evaluate(el => el.getAnimations().length)).toBe(0);
  }
  await expect(page.locator("#projects article")).toHaveCount(5);
});
