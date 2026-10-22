/* US-59: light and dark theme. System follows the OS; Light and Dark are set in Settings and survive a reload. */
import { expect, test, type Page } from "@playwright/test";
import { collectPageErrors, openSettings, resetApp, skipSetup } from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await resetApp(request);
  await skipSetup(page);
});

/** How light the page looks, 0 (black) to 1 (white): the page background is what the user sees as "the theme". */
async function backgroundLightness(page: Page) {
  return page.evaluate(() => {
    const [r = 0, g = 0, b = 0] = (getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g) ?? []).map(Number);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  });
}

/** `data-theme` on <html> is the app's own switch (set by the inline script in index.html); there is no visible text for it. */
const htmlTheme = (page: Page) => page.locator("html").getAttribute("data-theme");

test.describe("US-59 Theme", () => {
  test("System follows the operating system, in both directions", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "What are we practising today?", level: 1 })).toBeVisible();
    expect(await htmlTheme(page)).toBeNull();
    expect(await backgroundLightness(page)).toBeGreaterThan(0.6);

    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(() => backgroundLightness(page)).toBeLessThan(0.4);
  });

  test("happy path: pick Dark and Light in Settings, the choice is kept after a reload", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await openSettings(page);
    const theme = page.getByRole("radiogroup", { name: "Theme" });
    await expect(theme.getByRole("radio", { name: "System" })).toBeChecked();

    await theme.getByRole("radio", { name: "Dark" }).click();
    await expect(theme.getByRole("radio", { name: "Dark" })).toBeChecked();
    await expect.poll(() => backgroundLightness(page)).toBeLessThan(0.4);
    expect(await htmlTheme(page)).toBe("dark");

    // The choice is stored on this computer: the next load starts dark, even though the OS is light.
    await page.reload();
    expect(await htmlTheme(page)).toBe("dark");
    expect(await backgroundLightness(page)).toBeLessThan(0.4);

    // Settings is a route (/settings/general), so the reload lands on the open dialog.
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
    const again = page.getByRole("radiogroup", { name: "Theme" });
    await expect(again.getByRole("radio", { name: "Dark" })).toBeChecked();
    await again.getByRole("radio", { name: "Light" }).click();
    await expect.poll(() => backgroundLightness(page)).toBeGreaterThan(0.6);
    expect(await htmlTheme(page)).toBe("light");

    // Back to System removes the override.
    await again.getByRole("radio", { name: "System" }).click();
    await expect.poll(() => htmlTheme(page)).toBeNull();
    expect(errors).toEqual([]);
  });

  test("an explicit choice wins over the operating system", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript(() => window.localStorage.setItem("ic.theme", "light"));
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "What are we practising today?", level: 1 })).toBeVisible();
    expect(await htmlTheme(page)).toBe("light");
    expect(await backgroundLightness(page)).toBeGreaterThan(0.6);
  });

  test("negative: an unknown saved value falls back to System without an error", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.emulateMedia({ colorScheme: "light" });
    await page.addInitScript(() => window.localStorage.setItem("ic.theme", "purple"));
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "What are we practising today?", level: 1 })).toBeVisible();
    expect(await htmlTheme(page)).toBeNull();
    expect(await backgroundLightness(page)).toBeGreaterThan(0.6);
    await openSettings(page);
    await expect(page.getByRole("radiogroup", { name: "Theme" }).getByRole("radio", { name: "System" })).toBeChecked();
    expect(errors).toEqual([]);
  });

  test("negative: storage that throws does not break the page", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new DOMException("blocked", "SecurityError");
        },
      });
    });
    await page.goto("/setup");
    await expect(page.getByRole("heading", { name: "Choose how Mike runs", level: 1 })).toBeVisible();
    expect(errors).toEqual([]);
  });
});
