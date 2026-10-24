import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests', workers: 1, timeout: 60000, expect: { timeout: 15000 }, reporter: 'list' });
