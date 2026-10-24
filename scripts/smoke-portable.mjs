import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';

const data = await mkdtemp(path.join(os.tmpdir(), 'untrace-portable-'));
const env = { ...process.env, UNTRACE_TEST: '1', UNTRACE_DATA_DIR: data };
delete env.ELECTRON_RUN_AS_NODE;
const { version, build } = JSON.parse(await readFile('package.json', 'utf8'));
const architecture = process.argv[2] || 'x64';
if (!['x64', 'x86'].includes(architecture)) throw new Error('Expected x64 or x86.');
const artifact = `Untrace-Desktop-${version}-portable-${architecture}.exe`;
const processHandle = spawn(path.resolve('release', architecture, artifact), ['--remote-debugging-port=19384'], { env, windowsHide: true, stdio: 'ignore' });
let launchError;
processHandle.on('error', error => { launchError = error; });
let browser;
try {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (launchError) throw launchError;
    try { browser = await chromium.connectOverCDP('http://127.0.0.1:19384', { timeout: 1000 }); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  if (!browser) throw new Error('Portable app did not start within 60 seconds.');
  const page = browser.contexts()[0].pages()[0];
  await page.waitForURL('untrace://app/');
  await page.getByLabel('Open image file', { exact: true }).waitFor({ state: 'attached' });
  if (await page.title() !== build.productName) throw new Error('Unexpected window');
  console.log(`PASS: ${architecture} single-file portable extracted and loaded the offline app.`);
  const cdp = await browser.newBrowserCDPSession();
  await Promise.race([cdp.send('Browser.close').catch(() => {}), new Promise(resolve => setTimeout(resolve, 1000))]);
} finally {
  if (browser) await Promise.race([browser.close().catch(() => {}), new Promise(resolve => setTimeout(resolve, 1000))]);
  await new Promise(resolve => setTimeout(resolve, 1500));
  await rm(data, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
}
