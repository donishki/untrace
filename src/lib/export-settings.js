const KEY = 'untrace-export';
export function loadExportSettings() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(KEY)); } catch { /* Use defaults. */ }
  return {
    format: ['auto', 'image/png', 'image/jpeg'].includes(saved?.format) ? saved.format : 'auto',
    quality: [0.85, 0.92, 1].includes(saved?.quality) ? saved.quality : 0.92,
  };
}
export function saveExportSettings(format, quality) {
  try { localStorage.setItem(KEY, JSON.stringify({ format, quality: Number(quality) })); } catch { /* Keep session settings. */ }
}
