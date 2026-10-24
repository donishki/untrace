import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

let html = await readFile('dist/index.html', 'utf8');
const { build } = JSON.parse(await readFile('package.json', 'utf8'));
const brand = JSON.parse(await readFile('desktop/brand.json', 'utf8'));
if (build.productName !== brand.name || build.appId !== brand.appId) throw new Error('Desktop brand and package configuration must match.');
html = html.replace(/<link\b[^>]*href="https:\/\/fonts\.[^>]*>/g, '');
html = html.replace(/<title>.*?<\/title>/, `<title>${build.productName}</title>`);
const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
  .map(match => `'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`);
const policy = `default-src 'self'; script-src 'self' ${hashes.join(' ')}; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'`;
html = html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}">`);
await writeFile('dist/index.html', html);
for (const file of await readdir('dist/assets')) {
  if (!file.endsWith('.css')) continue;
  const location = `dist/assets/${file}`;
  const css = await readFile(location, 'utf8');
  await writeFile(location, css.replace(/@import\s*(?:url\([^)]*fonts\.googleapis[^)]*\)|["'][^"']*fonts\.googleapis[^"']*["'])\s*;/g, ''));
}
