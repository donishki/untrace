import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { readFileSync } from 'node:fs'
import { THEMES, bootstrapTheme } from './src/lib/theme-catalog.js'

const packageInfo = JSON.parse(readFileSync('./package.json', 'utf8'))
const brand = JSON.parse(readFileSync('./desktop/brand.json', 'utf8'))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte(), {
    name: 'theme-startup',
    transformIndexHtml: {
      order: 'pre',
      handler: html => html.replace('/* theme-bootstrap */', `(${bootstrapTheme.toString()})(${JSON.stringify(THEMES)});`),
    },
  }],
  define: { __APP_VERSION__: JSON.stringify(packageInfo.version), __APP_NAME__: JSON.stringify(brand.name) },
  base: '/',
  worker: { format: 'es' },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    cssMinify: 'lightningcss',
  },
})
