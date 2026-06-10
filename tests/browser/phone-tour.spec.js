import { expect, test } from "@playwright/test";

const STAGE = "#game-stage";

/**
 * Clears persisted state and starts the packaged guided tour.
 *
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @returns {Promise<void>}
 */
async function startTour(page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByLabel("Open phone")).toBeVisible();
}

/**
 * Advances the story until text appears.
 *
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @param {string|RegExp} text - Text to wait for.
 * @returns {Promise<import('@playwright/test').Locator>} Visible locator.
 */
async function advanceUntilVisible(page, text) {
  const target = page.getByText(text, { exact: typeof text === "string" });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await target.first().isVisible().catch(() => false)) {
      return target.first();
    }
    await page.locator(STAGE).click({ position: { x: 320, y: 320 } });
    await page.waitForTimeout(50);
  }
  await expect(target.first()).toBeVisible();
  return target.first();
}

/**
 * Chooses a visible guided-tour checkpoint option.
 *
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @param {string} prompt - Checkpoint prompt.
 * @param {string} option - Option text.
 * @returns {Promise<void>}
 */
async function chooseCheckpoint(page, prompt, option) {
  await advanceUntilVisible(page, prompt);
  await page.getByRole("option", { name: option }).click();
}

/**
 * Opens the floating phone and chooses an app from Home.
 *
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @param {string} appName - Accessible app label.
 * @returns {Promise<void>}
 */
async function openPhoneApp(page, appName) {
  await page.getByLabel(/Open phone|Return to story/).click();
  await expect(page.locator(".phone-home-shell")).toBeVisible();
  await page.getByRole("button", { name: appName }).click();
}

/**
 * Reads a small slice of live runner state through the dev-only test hook.
 *
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @returns {Promise<object>} Serializable runtime state summary.
 */
async function readRuntime(page) {
  return page.evaluate(() => {
    const runner = window.__JIISHII_TEST__?.runner;
    return {
      currentCommandIndex: runner?.state?.currentCommandIndex,
      currentSurface: runner?.state?.currentSurface,
      isRewound: runner?.isRewound,
      wallpaperImage: runner?.state?.visuals?.phone?.wallpaperImage,
      follows: runner?.state?.visuals?.social?.follows ?? {},
      likes: runner?.state?.visuals?.social?.likes ?? {}
    };
  });
}

test("phone apps stay above an IRL choice and Messages opens as inbox outside story texting", async ({ page }) => {
  await startTour(page);
  await advanceUntilVisible(page, "Gallery checkpoint");

  await openPhoneApp(page, "Messages");

  await expect(page.locator(".texting-shell")).toBeVisible();
  await expect(page.getByText("No conversations")).toBeVisible();
  await expect(page.locator(".irl-choice-overlay")).toHaveCount(1);

  const topLayer = await page.locator(".texting-shell .phone-frame").evaluate((frame) => {
    const rect = frame.getBoundingClientRect();
    const element = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return element?.closest(".texting-shell, .irl-choice-overlay")?.className ?? "";
  });
  expect(topLayer).toContain("texting-shell");

  await page.getByLabel("Return to story").click();
  await expect(page.getByRole("option", { name: "I checked the gallery and wallpaper." })).toBeVisible();
});

test("guided tour exercises gallery, wallpaper, social follow, like, and scroll guards", async ({ page }) => {
  await startTour(page);
  await advanceUntilVisible(page, "Gallery checkpoint");

  await openPhoneApp(page, "Gallery");
  await page.locator('[data-gallery-image="tour_wallpaper"]').click();
  await page.getByRole("button", { name: "Set wallpaper" }).click();
  await expect.poll(() => readRuntime(page).then((state) => state.wallpaperImage)).toBe("tour_gallery_wallpaper");

  await page.locator('[data-phone-nav="back"]').click();
  await page.locator('[data-phone-nav="home"]').click();
  await page.getByRole("button", { name: "Social" }).click();

  await expect(page.getByText("Your timeline is quiet.")).toBeVisible();
  await page.getByRole("tab", { name: "Discover" }).click();
  await page.locator('[data-social-follow="friend"]').click();
  await expect.poll(() => readRuntime(page).then((state) => state.follows.friend)).toBe(true);

  await page.getByRole("tab", { name: "Following" }).click();
  await expect(page.locator('[data-social-image="tour_alex_first_post"]')).toBeVisible();

  const beforeWheel = await readRuntime(page);
  await page.locator(".social-feed").hover();
  await page.mouse.wheel(0, -800);
  const afterWheel = await readRuntime(page);
  expect(afterWheel.currentCommandIndex).toBe(beforeWheel.currentCommandIndex);
  expect(afterWheel.isRewound).toBe(false);

  await page.locator('[data-social-like="tour_alex_first_post"]').click();
  await expect.poll(() => readRuntime(page).then((state) => state.likes.tour_alex_first_post)).toBe(true);
  await expect(page.locator(".social-action-button--like.is-like-flashing")).toHaveCount(1);

  await page.getByLabel("Return to story").click();
  await page.getByRole("option", { name: "I checked the gallery and wallpaper." }).click();
});

test("texting choices survive visiting Home and returning to the active story thread", async ({ page }) => {
  await startTour(page);

  await chooseCheckpoint(page, "Gallery checkpoint", "I checked the gallery and wallpaper.");
  await chooseCheckpoint(page, "Social checkpoint", "I followed Alex and opened the post.");
  await chooseCheckpoint(page, "Post image checkpoint", "The post image opened full-size.");
  await chooseCheckpoint(page, "Stream checkpoint", "Phone returns to the current surface.");
  await advanceUntilVisible(page, "The active thread kept its choice.");

  await expect(page.getByRole("button", { name: "The active thread kept its choice." })).toBeVisible();
  await expect(page.getByText("Open Home, look around, then return to this active thread. The choice should still be here.")).toHaveCount(1);

  await page.locator(".texting-shell .phone-home-button").click();
  await expect(page.locator(".phone-home-shell")).toBeVisible();
  await page.getByRole("button", { name: "Messages" }).click();

  await expect(page.locator(".texting-shell")).toBeVisible();
  await expect(page.getByRole("button", { name: "The active thread kept its choice." })).toBeVisible();
  await expect(page.getByText("Open Home, look around, then return to this active thread. The choice should still be here.")).toHaveCount(1);
});
