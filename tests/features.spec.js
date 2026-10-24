import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm, readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { compareMetadata, locationSummary } from '../src/lib/metadata-comparison.js';
import { readDroppedFiles } from '../src/lib/drop-files.js';
const { saveUnique } = createRequire(import.meta.url)('../desktop/output.cjs');

function gpsJpeg(jpeg) {
  const tiff = Buffer.alloc(128);
  tiff.write('II'); tiff.writeUInt16LE(42, 2); tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8); // IFD0: GPS pointer
  tiff.writeUInt16LE(0x8825, 10); tiff.writeUInt16LE(4, 12); tiff.writeUInt32LE(1, 14); tiff.writeUInt32LE(26, 18);
  tiff.writeUInt16LE(4, 26);
  function entry(offset, tag, type, count, value) {
    tiff.writeUInt16LE(tag, offset); tiff.writeUInt16LE(type, offset + 2); tiff.writeUInt32LE(count, offset + 4); tiff.writeUInt32LE(value, offset + 8);
  }
  entry(28, 1, 2, 2, 78); // N
  entry(40, 2, 5, 3, 80);
  entry(52, 3, 2, 2, 69); // E
  entry(64, 4, 5, 3, 104);
  [52, 30, 0, 13, 24, 0].forEach((v, i) => { tiff.writeUInt32LE(v, 80 + i * 8); tiff.writeUInt32LE(1, 84 + i * 8); });
  const payload = Buffer.concat([Buffer.from('Exif\0\0'), tiff]);
  const marker = Buffer.alloc(4); marker.writeUInt16BE(0xffe1); marker.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([jpeg.subarray(0, 2), marker, payload, jpeg.subarray(2)]);
}
async function launch() {
  const data = await mkdtemp(path.join(os.tmpdir(), 'untrace-features-'));
  const env = { ...process.env, UNTRACE_TEST: '1', UNTRACE_DATA_DIR: data };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ ...(process.env.UNTRACE_TEST_EXE ? { executablePath: process.env.UNTRACE_TEST_EXE } : {}), args: [...(process.env.UNTRACE_TEST_EXE ? [] : ['.']), '--disable-features=CalculateNativeWinOcclusion', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'], env });
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForLoadState('networkidle');
  return { app, page, data, close: async () => { await app.close(); await rm(data, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } };
}
async function jpeg(page) {
  return Buffer.from(await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 100;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = 'steelblue'; ctx.fillRect(0, 0, 160, 100);
    return canvas.toDataURL('image/jpeg').split(',')[1];
  }), 'base64');
}

test('comparison preserves uncertainty and folder enumeration drains every page', async () => {
  expect(compareMetadata({ GPS: { latitude: 0 } }, { scanError: 'Invalid segment' })[0].status).toBe('Unverified');
  expect(locationSummary({ GPS: { latitude: 0, longitude: 0 } })).toContain('0.000000, 0.000000');
  const groups = [[{ isFile: true, name: 'one.png', file: resolve => resolve({ name: 'one.png' }) }], [{ isFile: true, name: 'two.png', file: resolve => resolve({ name: 'two.png' }) }], []];
  const entry = { isDirectory: true, name: 'folder', createReader: () => ({ readEntries: resolve => resolve(groups.shift()) }) };
  expect((await readDroppedFiles([{ webkitGetAsEntry: () => entry }], [])).map(item => item.name)).toEqual(['folder/one.png', 'folder/two.png']);
});

test('output writes never overwrite and reject paths outside the chosen folder', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'untrace-output-'));
  try {
    await writeFile(path.join(dir, 'photo-cleaned.jpg'), 'original');
    const writes = await Promise.all([saveUnique(dir, 'photo-cleaned.jpg', Uint8Array.of(1)), saveUnique(dir, 'photo-cleaned.jpg', Uint8Array.of(2))]);
    expect(new Set(writes.map(file => file.filename)).size).toBe(2);
    expect(await readFile(path.join(dir, 'photo-cleaned.jpg'), 'utf8')).toBe('original');
    await expect(saveUnique(dir, '../escape.jpg', Uint8Array.of(1))).rejects.toThrow('Invalid output filename');
    await expect(saveUnique(dir, 'CON.jpg', Uint8Array.of(1))).rejects.toThrow('Invalid output filename');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('GPS warning, exact size preview, comparison, and export preferences', async () => {
  const { app, page, close } = await launch();
  try {
    const buffer = gpsJpeg(await jpeg(page));
    await page.getByLabel('Open image file', { exact: true }).setInputFiles({ name: 'location.jpg', mimeType: 'image/jpeg', buffer });
    await expect(page.getByText('Location data in original', { exact: true })).toBeVisible();
    await expect(page.getByText('Coordinates: 52.500000, 13.400000', { exact: true })).toBeVisible();
    await page.getByLabel('File format', { exact: true }).selectOption('image/jpeg');
    await page.getByLabel('JPEG quality', { exact: true }).selectOption('0.85');
    await page.getByRole('button', { name: 'Preview export size', exact: true }).click();
    await expect(page.getByText('Exact encoded size.', { exact: false })).toBeVisible();
    const size = await page.locator('.size-preview dd').first().textContent();
    await page.getByRole('button', { name: 'Clean image', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Save clean image' })).toBeVisible();
    await expect(page.locator('.output-name')).toContainText(size);
    await page.getByRole('button', { name: 'Compare metadata', exact: true }).click();
    const comparison = page.getByRole('dialog', { name: 'Metadata comparison' });
    await expect(comparison.getByRole('row').filter({ hasText: 'GPS / latitude' })).toContainText('Not detected afterward');
    if (!process.env.UNTRACE_TEST_EXE) await page.screenshot({ path: 'test-results/metadata-comparison.png' });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('link', { name: 'Save clean image' })).toBeVisible();
    const prepared = await page.getByRole('link', { name: 'Save clean image' }).getAttribute('href');
    await page.getByLabel('Open image file', { exact: true }).setInputFiles([{ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('notes') }, { name: 'document.pdf', mimeType: 'application/pdf', buffer: Buffer.from('document') }]);
    await expect(page.getByText('No supported images found.', { exact: false })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Save clean image' })).toHaveAttribute('href', prepared);
    await expect(page.getByRole('heading', { name: 'Batch cleaning' })).toHaveCount(0);
    await page.reload();
    await expect(page.getByLabel('File format', { exact: true })).toHaveValue('image/jpeg');
    await expect(page.getByLabel('JPEG quality', { exact: true })).toHaveValue('0.85');
    await page.evaluate(() => localStorage.setItem('untrace-export', '{broken'));
    await page.reload();
    await expect(page.getByLabel('File format', { exact: true })).toHaveValue('auto');
  } finally { await close(); }
});

test('nested folder batch reports mixed results and saves unique copies', async () => {
  const { app, page, data, close } = await launch();
  try {
    const source = path.join(data, 'source'), output = path.join(data, 'output');
    await mkdir(path.join(source, 'nested'), { recursive: true }); await mkdir(output);
    const buffer = gpsJpeg(await jpeg(page));
    await writeFile(path.join(source, 'photo.jpg'), buffer);
    await writeFile(path.join(source, 'nested', 'photo.jpg'), buffer);
    await writeFile(path.join(source, 'broken.jpg'), 'not an image');
    await writeFile(path.join(source, 'notes.txt'), 'keep this');
    await writeFile(path.join(source, 'nested', 'document.pdf'), 'not a picture');
    await writeFile(path.join(source, 'program.exe'), 'not a picture');
    await writeFile(path.join(output, 'photo-cleaned.jpg'), 'existing');
    await app.evaluate(({ dialog }, folder) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] }); }, output);
    await page.getByLabel('Open image folder', { exact: true }).setInputFiles(source);
    await expect(page.getByRole('heading', { name: 'Batch cleaning' })).toBeVisible();
    await expect(page.locator('.batch-row')).toHaveCount(3);
    await expect(page.locator('.batch-list')).not.toContainText('notes.txt');
    await expect(page.locator('.batch-list')).not.toContainText('document.pdf');
    await expect(page.locator('.batch-list')).not.toContainText('program.exe');
    await page.getByRole('button', { name: 'Clean batch', exact: true }).click();
    await expect(page.locator('.batch-heading')).toContainText('2 cleaned');
    await expect(page.locator('.batch-heading')).toContainText('1 failed');
    await page.getByRole('button', { name: 'Save cleaned files', exact: true }).click();
    await expect(page.locator('.batch-heading')).toContainText('2 saved');
    expect((await readdir(output)).sort()).toEqual(['photo-cleaned-2.jpg', 'photo-cleaned-3.jpg', 'photo-cleaned.jpg']);
    expect(await readFile(path.join(output, 'photo-cleaned.jpg'), 'utf8')).toBe('existing');
    expect(await readFile(path.join(source, 'photo.jpg'))).toEqual(buffer);
    expect((await readFile(path.join(output, 'photo-cleaned-2.jpg'))).includes(Buffer.from('Exif\0\0'))).toBe(false);
    if (!process.env.UNTRACE_TEST_EXE) await page.screenshot({ path: 'test-results/batch-results.png' });
    await expect(page.evaluate(() => window.untraceDesktop.saveOutput('fake-token', 'escape.jpg', new Uint8Array([1])))).rejects.toThrow('Choose an output folder');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(640, 700));
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await close(); }
});

test('cancellation terminates active work and remaining batch files can be retried', async () => {
  const { page, close } = await launch();
  try {
    const buffer = await jpeg(page);
    await page.evaluate(bytes => {
      const drop = new DataTransfer();
      for (const name of ['one.jpg', 'two.jpg']) drop.items.add(new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' }));
      drop.items.add(new File(['notes'], 'notes.txt', { type: 'text/plain' }));
      window.dispatchEvent(new DragEvent('drop', { dataTransfer: drop }));
    }, [...buffer]);
    await expect(page.getByRole('button', { name: 'Clean batch', exact: true })).toBeVisible();
    await expect(page.locator('.batch-row')).toHaveCount(2);
    await expect(page.locator('.batch-list')).not.toContainText('notes.txt');
    await page.evaluate(() => {
      const NativeWorker = window.Worker;
      window.__terminated = 0;
      window.__cleanTasks = 0;
      window.Worker = class extends NativeWorker {
        postMessage(data) { if (data.task === 'clean' && ++window.__cleanTasks === 2 && !window.__held) { window.__held = true; return; } super.postMessage(data); }
        terminate() { window.__terminated++; super.terminate(); }
      };
    });
    await page.getByRole('button', { name: 'Clean batch', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__held)).toBe(true);
    await page.getByRole('button', { name: 'Cancel processing', exact: true }).click();
    await expect(page.locator('.batch-heading')).toContainText('1 cancelled');
    await expect(page.locator('.batch-heading')).toContainText('1 cleaned');
    expect(await page.evaluate(() => window.__terminated)).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: 'Save cleaned files' })).toBeVisible();
    await page.getByRole('button', { name: 'Clean remaining images', exact: true }).click();
    await expect(page.locator('.batch-heading')).toContainText('2 cleaned');
    await page.getByRole('button', { name: 'Close batch', exact: true }).click();
    await page.getByLabel('Open image file', { exact: true }).setInputFiles({ name: 'single.jpg', mimeType: 'image/jpeg', buffer });
    await expect(page.getByRole('button', { name: 'Preview export size', exact: true })).toBeEnabled();
    await page.evaluate(() => { window.__held = false; window.__cleanTasks = 1; });
    await page.getByRole('button', { name: 'Preview export size', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel processing', exact: true }).click();
    await expect(page.getByText('Processing cancelled. Your original is unchanged.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Save clean image' })).toHaveCount(0);
  } finally { await close(); }
});

test('save cancellation finishes the current file and failed saves can be retried', async () => {
  const { app, page, data, close } = await launch();
  try {
    const output = path.join(data, 'output'); await mkdir(output);
    const buffer = await jpeg(page);
    await app.evaluate(({ dialog }, folder) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] }); }, output);
    await page.getByLabel('Open image file', { exact: true }).setInputFiles([{ name: 'one.jpg', mimeType: 'image/jpeg', buffer }, { name: 'two.jpg', mimeType: 'image/jpeg', buffer }]);
    await page.getByRole('button', { name: 'Clean batch', exact: true }).click();
    await expect(page.locator('.batch-heading')).toContainText('2 cleaned');
    await page.getByRole('button', { name: 'Choose output folder', exact: true }).click();
    // A drive disappears after selection: retain prepared blobs for a save retry.
    await rm(output, { recursive: true });
    await page.getByRole('button', { name: 'Save cleaned files', exact: true }).click();
    await expect(page.locator('.batch-heading')).toContainText('2 failed');
    await mkdir(output);
    // Hold the first real file write so cancellation can be exercised deterministically.
    await app.evaluate(async () => {
      const fs = process.getBuiltinModule('fs/promises');
      const nativeOpen = fs.open;
      fs.open = async (...args) => {
        const handle = await nativeOpen(...args);
        if (!global.__writeHeld && args[1] === 'wx') {
          global.__writeHeld = true;
          const nativeWrite = handle.writeFile.bind(handle);
          handle.writeFile = async bytes => { await new Promise(resolve => global.__releaseWrite = resolve); return nativeWrite(bytes); };
        }
        return handle;
      };
    });
    await page.getByRole('button', { name: 'Save cleaned files', exact: true }).click();
    await expect.poll(() => app.evaluate(() => typeof global.__releaseWrite)).toBe('function');
    await page.getByRole('button', { name: 'Cancel processing', exact: true }).click();
    await app.evaluate(() => global.__releaseWrite());
    await expect(page.locator('.batch-heading')).toContainText('1 saved');
    expect(await readdir(output)).toEqual(['one-cleaned.jpg']);
    expect((await readFile(path.join(output, 'one-cleaned.jpg'))).length).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Save cleaned files', exact: true }).click();
    await expect(page.locator('.batch-heading')).toContainText('2 saved');
  } finally { await close(); }
});
