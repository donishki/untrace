// readEntries returns batches (often 100 entries); drain each directory fully.
export async function readDroppedFiles(items, fallbackFiles, signal) {
  const entries = [...items].map(item => item.webkitGetAsEntry?.()).filter(Boolean);
  if (!entries.length) return [...fallbackFiles].map(file => ({ file, name: file.name }));
  const files = [];
  async function visit(entry, prefix = '') {
    signal?.throwIfAborted();
    const name = prefix + entry.name;
    try {
      if (entry.isFile) {
        const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
        files.push({ file, name });
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        while (true) {
          signal?.throwIfAborted();
          const group = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
          if (!group.length) break;
          for (const child of group) await visit(child, name + '/');
        }
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      files.push({ name, error: 'Could not read this file or folder.' });
    }
  }
  for (const entry of entries) await visit(entry);
  return files;
}
