const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

// Exclusive creation protects originals, existing exports and case-insensitive collisions.
async function saveUnique(directory, filename, bytes) {
  if (typeof filename !== 'string' || !/^[^<>:"/\\|?*\x00-\x1f]+\.(png|jpg)$/i.test(filename) || filename.length > 220 || /[. ]$/.test(filename) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])\./i.test(filename)) throw new Error('Invalid output filename.');
  if (!(bytes instanceof Uint8Array) || !bytes.byteLength) throw new Error('No encoded image data.');
  const extension = path.extname(filename), stem = filename.slice(0, -extension.length);
  for (let index = 1; index <= 10000; index++) {
    const name = `${stem}${index === 1 ? '' : '-' + index}${extension}`;
    const target = path.join(directory, name);
    let handle;
    try { handle = await fs.open(target, 'wx'); }
    catch (error) { if (error.code === 'EEXIST') continue; throw error; }
    try {
      await handle.writeFile(bytes);
      await handle.close();
      return { filename: name, path: target };
    } catch (error) {
      await handle.close().catch(() => {});
      await fs.unlink(target).catch(() => {});
      throw error;
    }
  }
  throw new Error('Too many files with this name. Choose another output folder.');
}

function registerOutput({ ipcMain, dialog, BrowserWindow }) {
  const folders = new Map();
  function check(event) {
    const url = new URL(event.senderFrame.url);
    if (event.senderFrame !== event.sender.mainFrame || url.protocol !== 'untrace:' || url.host !== 'app') throw new Error('Untrusted sender.');
  }
  ipcMain.handle('output:choose', async event => {
    check(event);
    const selection = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), { title: 'Choose output folder', properties: ['openDirectory', 'createDirectory'] });
    if (selection.canceled || !selection.filePaths[0]) return null;
    const directory = await fs.realpath(selection.filePaths[0]);
    const token = randomUUID();
    folders.set(event.sender.id, { token, directory });
    return { token, path: directory };
  });
  ipcMain.handle('output:save', async (event, token, filename, bytes) => {
    check(event);
    const folder = folders.get(event.sender.id);
    if (!folder || token !== folder.token) throw new Error('Choose an output folder first.');
    try { return await saveUnique(folder.directory, filename, bytes); }
    catch (error) {
      if (['EACCES', 'EPERM', 'EROFS'].includes(error.code)) throw new Error('The output folder is not writable. Choose another folder.');
      if (error.code === 'ENOSPC') throw new Error('The drive is full. Free space or choose another folder.');
      if (error.code === 'ENOENT') throw new Error('The output folder is unavailable. Choose it again.');
      throw error;
    }
  });
}
module.exports = { saveUnique, registerOutput };
