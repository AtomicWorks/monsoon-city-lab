import { expect, test, type Page } from "@playwright/test";

// A district edit should update the existing 3D scene, not build a new one:
// a new WebGL context means recompiling every shader, which made each paint
// stroke stall the page.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __links: number; __contexts: number };
    w.__links = 0;
    w.__contexts = 0;
    const proto = WebGL2RenderingContext.prototype;
    const link = proto.linkProgram;
    proto.linkProgram = function (program) {
      w.__links++;
      return link.call(this, program);
    };
    const getContext = HTMLCanvasElement.prototype.getContext as (
      this: HTMLCanvasElement,
      id: string,
      options?: unknown,
    ) => RenderingContext | null;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      id: string,
      options?: unknown,
    ) {
      const existing = (this as unknown as { __gl?: boolean }).__gl;
      const context = getContext.call(this, id, options);
      if (id === "webgl2" && context && !existing) {
        (this as unknown as { __gl?: boolean }).__gl = true;
        w.__contexts++;
      }
      return context;
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
});

const counts = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __links: number; __contexts: number };
    return { links: w.__links, contexts: w.__contexts };
  });

test("a district edit updates the scene without rebuilding WebGL", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/");
  const results = page.getByRole("region", { name: "Scenario results" });
  await expect(results.locator("strong").first()).toHaveText(/\d/, {
    timeout: 60_000,
  });
  await page
    .locator(".side-tabs")
    .getByRole("button", { name: "District" })
    .click();
  await page.waitForTimeout(2000);

  const canvas = page.locator(".city canvas");
  await canvas.evaluate((c) => (c.dataset.original = "yes"));
  const apply = page.getByRole("button", { name: /^Apply/ }).first();
  const undo = page.getByRole("button", { name: /^Undo/ }).first();

  // Warm-up edit. three.js draws the first shadow map before it has set up
  // the lights, so the first shadow update after load compiles the shadow
  // shaders once more with the real light count. Any edit triggers that,
  // with or without a rebuild, so measure from the second edit on.
  await apply.click();
  await page.waitForTimeout(2000);
  await undo.click();
  await page.waitForTimeout(2000);

  const before = await counts(page);
  const picture = await canvas.screenshot();
  await apply.click();
  await page.waitForTimeout(2000);
  const after = await counts(page);

  await expect(page.locator(".city canvas")).toHaveCount(1);
  expect(
    await page.locator(".city canvas").getAttribute("data-original"),
    "the same canvas should stay on the page",
  ).toBe("yes");
  expect(after.contexts - before.contexts, "no new WebGL context").toBe(0);
  expect(after.links - before.links, "no shaders recompiled").toBe(0);
  expect(
    (await canvas.screenshot()).equals(picture),
    "the painted blocks should change the picture",
  ).toBe(false);

  await undo.click();
  await page.waitForTimeout(2000);
  const undone = await counts(page);
  expect(undone.contexts - before.contexts).toBe(0);
  expect(undone.links - before.links).toBe(0);
});
