import { expect, test } from "@playwright/test";

// One pass through the production build: everything a first-time visitor
// relies on, including the lazily loaded scene and Planning lab, the
// self-hosted fonts and the simulation worker.
test("a visitor can load the district, run a storm and open the planning lab", async ({
  page,
  baseURL,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const external: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith(baseURL!)) external.push(r.url());
  });

  await page.goto("/");

  await test.step("the lazily loaded 3D scene renders", async () => {
    const canvas = page.locator(".city canvas");
    await expect(canvas).toHaveCount(1, { timeout: 30_000 });
    const live = await canvas.evaluate((c: HTMLCanvasElement) => {
      const gl = c.getContext("webgl2");
      return !!gl && !gl.isContextLost();
    });
    expect(live, "the scene should hold a live WebGL context").toBe(true);
  });

  await test.step("the self-hosted fonts load", async () => {
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready;
      return {
        dmSans: document.fonts.check('450 16px "DM Sans"'),
        manrope: document.fonts.check("650 16px Manrope"),
      };
    });
    expect(loaded).toEqual({ dmSans: true, manrope: true });
  });

  await test.step("running a storm produces results", async () => {
    const results = page.getByRole("region", { name: "Scenario results" });
    const floodedArea = results.locator("strong").first();
    // The app runs the default storm on load; wait for it, then run again.
    await expect(floodedArea).toHaveText(/^\d[\d.,]* ha$/, { timeout: 60_000 });
    await page.locator("button.run", { hasText: "Run storm" }).click();
    await expect(
      page.getByText("Rainfall and recovery complete").first(),
    ).toBeVisible({ timeout: 60_000 });
    await expect(floodedArea).toHaveText(/^\d[\d.,]* ha$/);
  });

  await test.step("the lazily loaded planning lab opens", async () => {
    await page.locator('[data-guide="planning"]').click();
    await expect(
      page.getByRole("heading", { name: "Find a better plan." }),
    ).toBeVisible();
  });

  expect(errors, "no console errors").toEqual([]);
  expect(external, "no requests to other hosts").toEqual([]);
});
