import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Automated WCAG 2.1 A/AA checks across the studio's main states. This
// catches common problems (contrast, names, labels, ARIA misuse); it is not
// a substitute for testing with a screen reader or keyboard alone.
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function scan(page: Page, state: string, found: string[]) {
  // Panels and dialogs fade in; scanning mid-fade measures half-transparent
  // text. Wait for running finite animations (not spinners or paused ones)
  // to finish, for at most three seconds.
  await page.evaluate(() =>
    Promise.race([
      Promise.all(
        document
          .getAnimations()
          .filter(
            (a) =>
              a.playState === "running" &&
              a.effect?.getComputedTiming().endTime !== Infinity,
          )
          .map((a) => a.finished.catch(() => undefined)),
      ),
      new Promise((done) => setTimeout(done, 3000)),
    ]),
  );
  const { violations } = await new AxeBuilder({ page })
    .withTags(TAGS)
    .analyze();
  for (const v of violations)
    for (const node of v.nodes)
      found.push(
        `${state} · ${v.id} (${v.impact}) · ${node.target.join(" ")} · ${node.failureSummary?.split("\n").slice(1).join(" ").trim()}`,
      );
}

test("the studio's main states have no automatically detectable WCAG A/AA violations", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const found: string[] = [];
  const button = (name: string | RegExp) =>
    page.getByRole("button", { name, exact: typeof name === "string" });

  await page.goto("/");
  await expect(page.locator(".city canvas")).toHaveCount(1, {
    timeout: 30_000,
  });
  const results = page.getByRole("region", { name: "Scenario results" });
  await expect(results.locator("strong").first()).toHaveText(/\d/, {
    timeout: 60_000,
  });
  await scan(page, "studio", found);

  for (const tab of ["Storm", "Build", "Replay", "City", "District"]) {
    await page.locator(".side-tabs").getByRole("button", { name: tab }).click();
    await scan(page, `${tab} tab`, found);
  }

  await page
    .locator(".side-tabs")
    .getByRole("button", { name: "Missions" })
    .click();
  await button("Compare scenarios").click();
  await expect(page.locator(".map-canvases canvas")).toHaveCount(2, {
    timeout: 30_000,
  });
  await scan(page, "comparison", found);

  await button("View report").click();
  await expect(page.locator("dialog[open]")).toBeVisible();
  await scan(page, "report dialog", found);
  await button("Close dialog").click();

  await button(/Read the assumptions/).click();
  await expect(page.locator("dialog[open]")).toBeVisible();
  await scan(page, "field notes", found);
  await button("Close dialog").click();

  await button(/^Help/).first().click();
  await scan(page, "help centre", found);
  await page.keyboard.press("Escape");

  await button(/^Graphics/)
    .first()
    .click();
  await scan(page, "graphics panel", found);
  await page.keyboard.press("Escape");

  await button(/^Planning lab/)
    .first()
    .click();
  await expect(page.getByText("Find a better plan.")).toBeVisible({
    timeout: 30_000,
  });
  await scan(page, "planning lab", found);

  expect(found, found.join("\n")).toEqual([]);
});
