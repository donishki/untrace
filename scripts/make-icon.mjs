import { _electron as electron } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const data = await mkdtemp(path.join(os.tmpdir(), 'untrace-icon-'));
const env = { ...process.env, UNTRACE_TEST: '1', UNTRACE_DATA_DIR: data };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ['.'], env });
try {
  const page = await app.firstWindow();
  const encoded = await page.evaluate(async () => {
    const img = new Image(); img.src = '/favicon.svg'; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
    canvas.getContext('2d').drawImage(img, 0, 0, 256, 256);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const png = Buffer.from(encoded, 'base64');
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
  header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
  await writeFile('desktop/icon.ico', Buffer.concat([header, png]));
} finally {
  await app.close();
  await rm(data, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
