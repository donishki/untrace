import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { isAccepted } from '../src/lib/metadata.js';

function withTextMetadata(png) {
  const payload = Buffer.from('tEXtSoftware\0OpenAI API');
  let crc = 0xffffffff;
  for (const byte of payload) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  const size = Buffer.alloc(4); size.writeUInt32BE(payload.length - 4);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([png.subarray(0, -12), size, payload, checksum, png.subarray(-12)]);
}

test('Windows files without a MIME type are accepted by extension', () => {
  expect(isAccepted({ name: 'PHOTO.JPG', type: '' })).toBe(true);
  expect(isAccepted({ name: 'photo.png', type: 'application/octet-stream' })).toBe(true);
  expect(isAccepted({ name: 'program.exe', type: '' })).toBe(false);
  expect(isAccepted({ name: 'fake.jpg', type: 'text/plain' })).toBe(false);
});

test('offline desktop cleans images and reports corrupt input honestly', async () => {
  const data = await mkdtemp(path.join(os.tmpdir(), 'untrace-test-'));
  const env = { ...process.env, UNTRACE_TEST: '1', UNTRACE_DATA_DIR: data };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    ...(process.env.UNTRACE_TEST_EXE ? { executablePath: process.env.UNTRACE_TEST_EXE } : {}),
    // Hidden Windows test windows must keep rendering and canvas work scheduled.
    args: [...(process.env.UNTRACE_TEST_EXE ? [] : ['.']), '--disable-features=CalculateNativeWinOcclusion', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
    env,
  });
  try {
    const page = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Inspector', exact: true })).toBeVisible();
    await expect(page.locator('.btn-primary')).toHaveCount(1);
    if (!process.env.UNTRACE_TEST_EXE) await page.screenshot({ path: 'test-results/workspace-light.png' });
    await page.getByRole('button', { name: 'Choose a theme' }).click();
    await page.getByRole('radio', { name: /^Dark / }).check();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    if (!process.env.UNTRACE_TEST_EXE) await page.screenshot({ path: 'test-results/workspace-dark.png' });
    await page.keyboard.press('F1');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    const fileChooser = page.waitForEvent('filechooser');
    await page.keyboard.press('Control+o');
    await fileChooser;
    const metrics = await app.evaluate(({ app }) => app.getAppMetrics().map(({ type, memory }) => ({ type, workingSetKB: memory.workingSetSize })));
    await writeFile('test-results/idle-memory.json', JSON.stringify(metrics, null, 2));
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(640, 700));
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (!process.env.UNTRACE_TEST_EXE) await page.screenshot({ path: 'test-results/workspace-small.png', fullPage: true });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1200, 900));
    expect(await page.evaluate(() => typeof window.require)).toBe('undefined');
    expect(await page.evaluate(() => fetch('https://example.com').then(() => false).catch(() => true))).toBe(true);
    const image = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 1100; canvas.height = 1000;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'red'; ctx.fillRect(50, 50, 100, 100);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await page.getByLabel('Open image file', { exact: true }).setInputFiles({ name: 'transparent.png', mimeType: 'image/png', buffer: withTextMetadata(Buffer.from(image, 'base64')) });
    await page.getByRole('button', { name: 'Clean image', exact: true }).click();
    const download = page.getByRole('link', { name: 'Save clean image' });
    await expect(download).toBeVisible();
    await expect(download).toHaveAttribute('download', 'transparent-cleaned.jpg');
    if (!process.env.UNTRACE_TEST_EXE) await page.screenshot({ path: 'test-results/workspace-result.png' });
    const output = await download.getAttribute('href');
    await page.getByRole('button', { name: 'Choose a theme' }).click();
    await page.getByRole('radio', { name: /^Ember / }).check();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(download).toHaveAttribute('href', output);
    const pixel = await page.evaluate(async url => {
      const img = new Image(); img.src = url; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
      return [...ctx.getImageData(0, 0, 1, 1).data];
    }, output);
    expect(pixel).toEqual([255, 255, 255, 255]);
    await app.evaluate(({ session }, destination) => session.defaultSession.once('will-download', (_event, item) => item.setSavePath(destination)), path.join(data, 'result.jpg'));
    await download.click();
    await expect.poll(async () => (await readFile(path.join(data, 'result.jpg')).catch(() => Buffer.alloc(0))).length).toBeGreaterThan(0);
    expect((await readFile(path.join(data, 'result.jpg'))).includes(Buffer.from('OpenAI API'))).toBe(false);
    // Choosing lossless PNG invalidates the previous export and preserves alpha.
    await page.getByLabel('File format', { exact: true }).selectOption('image/png');
    await expect(download).toHaveCount(0);
    await page.keyboard.press('Control+Enter');
    await expect(download).toHaveAttribute('download', 'transparent-cleaned.png');
    const alpha = await page.evaluate(async url => {
      const img = new Image(); img.src = url; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
      const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
      return ctx.getImageData(0, 0, 1, 1).data[3];
    }, await download.getAttribute('href'));
    expect(alpha).toBe(0);
    await page.getByRole('button', { name: 'Original', exact: true }).click();
    await expect(page.getByAltText('Original image preview')).toBeVisible();
    await page.getByRole('button', { name: 'Cleaned copy', exact: true }).click();
    await expect(page.getByAltText('Cleaned image preview')).toBeVisible();
    await page.getByRole('button', { name: 'Close image', exact: true }).click();
    await page.getByLabel('Open image file', { exact: true }).setInputFiles({ name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not an image') });
    await page.getByRole('button', { name: 'Clean image', exact: true }).click();
    await expect(page.getByText('Not cleaned', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Save clean image' })).toHaveCount(0);
    await expect(page.locator('.removed')).toHaveCount(0);
    if (!process.env.UNTRACE_TEST_EXE) await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  } finally {
    await app.close();
    await rm(data, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
