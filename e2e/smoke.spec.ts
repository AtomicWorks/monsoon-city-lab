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
    // Performance notes from the software GL driver come from the test
    // browser, not the app.
    if (m.text().includes("GL Driver Message")) return;
    if (m.type() === "error" || m.type() === "warning")
      errors.push(`${m.type()}: ${m.text()}`);
  });
  const external: string[] = [];
  const fontRequests: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith(baseURL!)) external.push(r.url());
    if (r.url().endsWith(".woff2"))
      fontRequests.push(new URL(r.url()).pathname);
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

    // The Latin faces are preloaded so text does not swap fonts after first
    // paint, and a preload that does not match the CSS request would
    // download the same file twice.
    const preloads = await page
      .locator('link[rel="preload"][as="font"]')
      .evaluateAll((links) =>
        links.map((l) => new URL((l as HTMLLinkElement).href).pathname),
      );
    expect(preloads.map((p) => p.replace(/-[\w-]{8}\.woff2$/, ""))).toEqual([
      "/assets/dm-sans-latin-wght-normal",
      "/assets/manrope-latin-wght-normal",
    ]);
    for (const file of preloads)
      expect(
        fontRequests.filter((r) => r === file),
        `${file} should download once`,
      ).toHaveLength(1);
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

  expect(errors, "no console errors or warnings").toEqual([]);
  expect(external, "no requests to other hosts").toEqual([]);
});
