import { expect, test, type Page } from "@playwright/test";

// The 3D scene should only draw when something on screen changes, so an
// idle page leaves the GPU (and battery) alone. Draw calls are counted by
// wrapping WebGL's draw functions before the app loads.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __draws: number };
    w.__draws = 0;
    const proto = WebGL2RenderingContext.prototype as unknown as Record<
      string,
      (...args: unknown[]) => unknown
    >;
    for (const name of [
      "drawArrays",
      "drawElements",
      "drawArraysInstanced",
      "drawElementsInstanced",
    ]) {
      const original = proto[name];
      proto[name] = function (this: unknown, ...args: unknown[]) {
        w.__draws++;
        return original.apply(this, args);
      };
    }
  });
});

const draws = (page: Page) =>
  page.evaluate(() => (window as unknown as { __draws: number }).__draws);

// Waits until a full second passes with no draws; returns how long it took.
async function settles(page: Page, timeout = 20_000) {
  const start = Date.now();
  await expect
    .poll(() => drawsDuring(page, 1000), {
      timeout,
      intervals: [0],
      message: "the scene should stop drawing once nothing moves",
    })
    .toBe(0);
  return Date.now() - start;
}

async function drawsDuring(
  page: Page,
  ms: number,
  action?: () => Promise<void>,
) {
  const before = await draws(page);
  await action?.();
  await page.waitForTimeout(ms);
  return (await draws(page)) - before;
}

test("the 3D scene stops drawing when idle and redraws on change", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/");
  const results = page.getByRole("region", { name: "Scenario results" });
  await expect(results.locator("strong").first()).toHaveText(/\d/, {
    timeout: 60_000,
  });
  // Any app update wakes the scene for two frames, so first wait for the
  // run's follow-up updates: the completion notice hides after 6.5 s, and
  // autosave confirms when IndexedDB finishes (slower on CI machines). A
  // fixed wait was not enough there.
  await expect(page.locator(".toast")).toHaveAttribute(
    "data-visible",
    "false",
    {
      timeout: 20_000,
    },
  );
  await expect(page.getByText("Saved on this device")).toBeVisible({
    timeout: 20_000,
  });

  await test.step("idle: no draws", async () => {
    await settles(page);
    expect(await drawsDuring(page, 2000)).toBe(0);
  });

  await test.step("moving the timeline redraws, then goes idle again", async () => {
    const slider = page.getByRole("slider", {
      name: "Simulation time in minutes",
    });
    // Move to whichever end the slider is not already at.
    const atStart = (await slider.inputValue()) === "0";
    const changed = await drawsDuring(page, 1500, async () => {
      await slider.focus();
      await slider.press(atStart ? "End" : "Home");
    });
    expect(changed).toBeGreaterThan(0);
    console.log(`timeline settled in ${await settles(page)} ms`);
  });

  await test.step("dragging the camera redraws", async () => {
    const canvas = page.locator(".city canvas");
    const box = (await canvas.boundingBox())!;
    const dragged = await drawsDuring(page, 500, async () => {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        box.x + box.width / 2 + 120,
        box.y + box.height / 2,
        {
          steps: 8,
        },
      );
      await page.mouse.up();
    });
    expect(dragged).toBeGreaterThan(0);
    console.log(`drag settled in ${await settles(page)} ms`);
  });

  await test.step("playback keeps drawing until paused", async () => {
    await page
      .getByRole("slider", { name: "Simulation time in minutes" })
      .press("Home");
    await page.getByRole("button", { name: "Play simulation" }).click();
    const first = await drawsDuring(page, 1000);
    const second = await drawsDuring(page, 1000);
    expect(first).toBeGreaterThan(0);
    expect(second).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Pause playback" }).click();
    console.log(`pause settled in ${await settles(page)} ms`);
  });
});
