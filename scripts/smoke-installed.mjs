import { _electron as electron, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const [executablePath, architecture] = process.argv.slice(2);
if (!executablePath || !['x64', 'ia32'].includes(architecture)) throw new Error('Pass installed executable path and x64 or ia32.');
const env = { ...process.env, UNTRACE_TEST: '1' };
delete env.ELECTRON_RUN_AS_NODE;
delete env.UNTRACE_DATA_DIR;
delete env.PORTABLE_EXECUTABLE_DIR;
const app = await electron.launch({ executablePath, env });
try {
  const page = await app.firstWindow();
  await expect(page.getByRole('heading', { name: 'Inspector', exact: true })).toBeVisible();
  const actual = await app.evaluate(({ app }) => ({ architecture: process.arch, data: app.getPath('userData'), appData: app.getPath('appData'), version: app.getVersion() }));
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  if (actual.architecture !== architecture || actual.version !== version) throw new Error('Installed architecture/version mismatch.');
  if (actual.data !== path.join(actual.appData, 'Untrace Desktop')) throw new Error('Installed settings path mismatch.');
  if (await page.evaluate(() => typeof window.require) !== 'undefined') throw new Error('Renderer has Node access.');
  if (await page.evaluate(() => fetch('https://example.com').then(() => true).catch(() => false))) throw new Error('Unexpected network access.');
  console.log(`PASS: installed ${architecture} ${version} launches offline with isolated renderer and per-user settings.`);
} finally { await app.close(); }
