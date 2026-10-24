import { _electron as electron, expect } from '@playwright/test';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const data = await mkdtemp(path.join(os.tmpdir(), 'untrace-screenshots-'));
const env = { ...process.env, UNTRACE_TEST: '1', UNTRACE_DATA_DIR: data };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ['.', '--disable-features=CalculateNativeWinOcclusion', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'], env });
await mkdir('docs/screenshots', { recursive: true });
try {
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.setContentSize(1440, 960); win.webContents.setBackgroundThrottling(false); });
  await page.waitForLoadState('networkidle');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => localStorage.setItem('untrace-theme', 'graphite'));
  await page.reload();
  // Original generated artwork, not a private photo. Only sample pixels enter the app.
  const bytes = Buffer.from(await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1800; canvas.height = 1200;
    const c = canvas.getContext('2d');
    const sky = c.createLinearGradient(0, 0, 0, 750); sky.addColorStop(0, '#254e6b'); sky.addColorStop(.65, '#9bb7b2'); sky.addColorStop(1, '#f6d5aa'); c.fillStyle = sky; c.fillRect(0, 0, 1800, 1200);
    c.fillStyle = '#f6e7bd'; c.beginPath(); c.arc(1300, 270, 68, 0, Math.PI * 2); c.fill();
    function mountain(points, color) { c.fillStyle = color; c.beginPath(); c.moveTo(0, 760); for (const [x,y] of points) c.lineTo(x,y); c.lineTo(1800,760); c.closePath(); c.fill(); }
    mountain([[0,520],[240,300],[420,460],[680,180],[950,480],[1220,260],[1500,430],[1800,220]], '#637e8b');
    mountain([[0,680],[340,430],[600,680],[890,360],[1170,610],[1430,390],[1800,640]], '#345867');
    c.fillStyle = '#dce5df'; c.beginPath(); c.moveTo(510,395); c.lineTo(680,180); c.lineTo(800,323); c.lineTo(710,292); c.lineTo(670,335); c.lineTo(625,307); c.fill();
    const lake = c.createLinearGradient(0, 740, 0, 1200); lake.addColorStop(0,'#9bb5b0'); lake.addColorStop(1,'#274d5d'); c.fillStyle = lake; c.fillRect(0,740,1800,460);
    for(let i=0;i<60;i++){ const y=770+i*7; c.fillStyle=i%3===0?'#99b0aa66':'#c9d5bd33'; c.fillRect((i*137)%1800,y,80+(i*31)%340,2); }
    for(let i=0;i<42;i++){const x=i*47, h=65+(i*43)%130; c.fillStyle='#193f47'; c.beginPath(); c.moveTo(x,760-h); c.lineTo(x-24,770); c.lineTo(x+24,770); c.fill();}
    c.fillStyle='#183c45'; c.beginPath(); c.moveTo(0,970); c.quadraticCurveTo(260,880,470,1200); c.lineTo(0,1200); c.fill();
    return canvas.toDataURL('image/jpeg', .95).split(',')[1];
  }), 'base64');
  const sample = { name: 'Alpine-lake.jpg', mimeType: 'image/jpeg', buffer: bytes };
  await page.getByLabel('Open image file', { exact: true }).setInputFiles(sample);
  await page.getByLabel('File format', { exact: true }).selectOption('image/jpeg');
  await page.getByRole('button', { name: 'Clean image', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Save clean image' })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/workspace-dark.png' });
  await page.evaluate(() => localStorage.setItem('untrace-theme', 'light'));
  await page.reload();
  await page.getByLabel('Open image file', { exact: true }).setInputFiles(sample);
  await expect(page.getByRole('button', { name: 'Clean image', exact: true })).toBeEnabled();
  await page.screenshot({ path: 'docs/screenshots/workspace-light.png' });
  await page.getByLabel('Open image file', { exact: true }).setInputFiles(['Alpine-lake.jpg','Mountain-reflections.jpg','Morning-light.jpg','Forest-shore.jpg'].map(name => ({ ...sample, name })));
  await expect(page.getByRole('button', { name: 'Clean batch', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Clean batch', exact: true }).click();
  await expect(page.getByText('Cleaned', { exact: true })).toHaveCount(4);
  await page.screenshot({ path: 'docs/screenshots/batch-light.png' });
  console.log('Captured three real application screenshots using generated sample artwork.');
} finally {
  await app.close();
  await rm(data, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
