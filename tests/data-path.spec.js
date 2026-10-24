import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';
const { dataPath } = createRequire(import.meta.url)('../desktop/data-path.cjs');

test('installed settings stay outside program files and portable settings travel with the launcher', () => {
  const appData = path.resolve('test-profile');
  const portable = path.resolve('usb');
  expect(dataPath({ env: {}, appData })).toBe(path.join(appData, 'Untrace Desktop'));
  expect(dataPath({ env: { PORTABLE_EXECUTABLE_DIR: portable }, appData })).toBe(path.join(portable, 'Untrace-data'));
  expect(dataPath({ env: { PORTABLE_EXECUTABLE_DIR: portable, UNTRACE_DATA_DIR: 'test-override' }, appData })).toBe('test-override');
});
