import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { THEMES } from '../src/lib/theme-catalog.js';

test('themes persist, follow Windows, and keep readable contrast', async () => {
  const data = await mkdtemp(path.join(os.tmpdir(), 'untrace-themes-'));
  const env = { ...process.env, UNTRACE_TEST: '1', UNTRACE_DATA_DIR: data };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    ...(process.env.UNTRACE_TEST_EXE ? { executablePath: process.env.UNTRACE_TEST_EXE } : {}),
    args: [...(process.env.UNTRACE_TEST_EXE ? [] : ['.']), '--disable-features=CalculateNativeWinOcclusion', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'], env,
  });
  try {
    const page = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle('Untrace Desktop');
    await expect(page.getByRole('heading', { name: 'Untrace Desktop', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Choose a theme' }).click();
    const dialog = page.getByRole('dialog', { name: 'Appearance' });
    await expect(dialog).toBeVisible();
    for (const item of THEMES) {
      await page.getByRole('radio', { name: new RegExp(`^${item.name} `) }).check();
      await expect(page.locator('html')).toHaveAttribute('data-theme', item.id);
      const contrasts = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        function luminance(value) {
          let hex = value.trim().replace('#', '');
          if (hex.length === 3) hex = [...hex].map(char => char + char).join('');
          const values = hex.match(/../g).map(part => parseInt(part, 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
          return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
        }
        function ratio(a, b, scope = style) {
          const x = luminance(scope.getPropertyValue(a)), y = luminance(scope.getPropertyValue(b));
          return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
        }
        const header = getComputedStyle(document.querySelector('.app-header'));
        return ['--text-1', '--text-2', '--text-3'].flatMap(text => ['--bg', '--surface'].map(bg => ratio(text, bg))).concat(ratio('--accent-fg', '--accent'), ratio('--text-3', '--surface', header));
      });
      if (!process.env.UNTRACE_TEST_EXE && (item.replaces || item.id === 'tokyo-night')) {
        await page.getByRole('button', { name: 'Done', exact: true }).click();
        await page.screenshot({ path: 'test-results/theme-' + item.id + '.png' });
        await page.getByRole('button', { name: 'Choose a theme' }).click();
      }
      expect(Math.min(...contrasts), `${item.name} text contrast`).toBeGreaterThanOrEqual(4.5);
    }
    await page.getByRole('radio', { name: /^Tokyo Night / }).check();
    await page.evaluate(() => document.querySelector('.theme-choices').scrollTop = 0);
    if (!process.env.UNTRACE_TEST_EXE) await page.screenshot({ path: 'test-results/editor-themes.png' });
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'tokyo-night');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(640, 700));
    await page.getByRole('button', { name: 'Choose a theme' }).click();
    await page.getByRole('radio', { name: /^Ember / }).check();
    const fits = await dialog.evaluate(el => {
      const rect = el.getBoundingClientRect();
      const done = el.querySelector('.appearance-footer').getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight && done.bottom <= innerHeight && el.scrollWidth <= el.clientWidth;
    });
    expect(fits, 'picker and Done fit a small window').toBe(true);
    if (!process.env.UNTRACE_TEST_EXE) await page.screenshot({ path: 'test-results/themes-small.png' });
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1200, 900));
    await page.getByRole('button', { name: 'Choose a theme' }).click();
    await page.getByRole('radio', { name: /^Cobalt / }).check();
    if (!process.env.UNTRACE_TEST_EXE) await page.screenshot({ path: 'test-results/appearance.png' });
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    if (!process.env.UNTRACE_TEST_EXE) await page.screenshot({ path: 'test-results/cobalt.png' });
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'cobalt');
    await page.getByRole('button', { name: 'Choose a theme' }).click();
    await expect(page.getByRole('radio', { name: /^Cobalt / })).toBeChecked();
    await page.getByRole('radio', { name: /^Follow Windows/ }).check();
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByRole('radio', { name: /^Graphite / }).check();
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'graphite');
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    // Saved names from the previous release migrate before the first paint.
    for (const item of THEMES.filter(item => item.replaces)) {
      await page.evaluate(id => localStorage.setItem('untrace-theme', id), item.replaces);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', item.id);
      expect(await page.evaluate(() => localStorage.getItem('untrace-theme'))).toBe(item.id);
    }
    // Invalid legacy data falls back safely instead of applying an unknown palette.
    await page.evaluate(() => localStorage.setItem('untrace-theme', 'unknown-theme'));
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  } finally {
    await app.close();
    await rm(data, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
