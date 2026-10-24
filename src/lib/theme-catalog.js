export const THEMES = [
  { id: 'light', name: 'Light', description: 'Clean white, blue accents', scheme: 'light' },
  { id: 'dark', name: 'Dark', description: 'Charcoal, soft periwinkle', scheme: 'dark' },
  { id: 'graphite', name: 'Graphite', description: 'Neutral charcoal, silver', scheme: 'dark', replaces: 'forest' },
  { id: 'paper', name: 'Paper', description: 'Warm paper, dark olive ink', scheme: 'light', replaces: 'sand' },
  { id: 'cobalt', name: 'Cobalt', description: 'Navy frame, crisp blue', scheme: 'light', replaces: 'midnight' },
  { id: 'ember', name: 'Ember', description: 'Carbon black, warm orange', scheme: 'dark', replaces: 'plum' },
  { id: 'one-dark', name: 'One Dark', description: 'Slate grey, signature blue', scheme: 'dark', editor: true },
  { id: 'dracula', name: 'Dracula', description: 'Purple charcoal, lavender', scheme: 'dark', editor: true },
  { id: 'tokyo-night', name: 'Tokyo Night', description: 'Inky blue, electric periwinkle', scheme: 'dark', editor: true },
  { id: 'night-owl', name: 'Night Owl', description: 'Deep ocean, mint accents', scheme: 'dark', editor: true },
  { id: 'github-dark', name: 'GitHub Dark', description: 'Cool graphite, GitHub green', scheme: 'dark', editor: true },
  { id: 'github-light', name: 'GitHub Light', description: 'Porcelain, forest green', scheme: 'light', editor: true },
  { id: 'catppuccin-mocha', name: 'Catppuccin Mocha', description: 'Soft charcoal, pastel mauve', scheme: 'dark', editor: true },
  { id: 'catppuccin-latte', name: 'Catppuccin Latte', description: 'Creamy grey, violet accents', scheme: 'light', editor: true },
];

// Standalone so Vite can inline the same startup logic before the first paint.
export function bootstrapTheme(themes) {
  let choice = 'system';
  try {
    const saved = localStorage.getItem('untrace-theme');
    const match = themes.find(item => item.id === saved || item.replaces === saved);
    if (saved === 'system') choice = saved;
    else if (match) {
      choice = match.id;
      if (saved !== choice) localStorage.setItem('untrace-theme', choice);
    }
  } catch { /* Storage may be unavailable. */ }
  const resolved = choice === 'system'
    ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : choice;
  document.documentElement.setAttribute('data-theme', resolved);
  return choice;
}
