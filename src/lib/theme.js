import { writable } from 'svelte/store';
import { THEMES, bootstrapTheme } from './theme-catalog.js';

export { THEMES };
const STORAGE_KEY = 'untrace-theme'; // Keep existing portable preferences.
const valid = choice => choice === 'system' || THEMES.some(item => item.id === choice);

function createTheme() {
  const { subscribe, set } = writable('system');
  let current = 'system';
  let media;
  function apply(choice) {
    current = valid(choice) ? choice : 'system';
    const resolved = current === 'system'
      ? ((media || matchMedia('(prefers-color-scheme: light)')).matches ? 'light' : 'dark')
      : current;
    document.documentElement.setAttribute('data-theme', resolved);
    set(current);
  }
  function select(choice) {
    apply(choice);
    try { localStorage.setItem(STORAGE_KEY, current); } catch { /* Keep session choice. */ }
  }
  return {
    subscribe,
    init() {
      media = matchMedia('(prefers-color-scheme: light)');
      apply(bootstrapTheme(THEMES));
      const onSystemChange = () => { if (current === 'system') apply('system'); };
      media.addEventListener('change', onSystemChange);
      return () => media.removeEventListener('change', onSystemChange);
    },
    select,
    // Retained for the unused upstream toggle component.
    toggle() { select(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'); },
  };
}
export const theme = createTheme();

export function motionSafe(ms) {
  if (typeof window === 'undefined') return ms;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms;
}
