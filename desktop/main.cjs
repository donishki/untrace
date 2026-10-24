const { app, BrowserWindow, session, protocol, net, shell, dialog, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { name: productName, appId } = require('./brand.json');
app.setName(productName);
app.setAppUserModelId(appId);

// Portable settings travel with the launcher. Installed settings survive upgrades/uninstall.
const data = require('./data-path.cjs').dataPath({ env: process.env, appData: app.getPath('appData') });
try {
  fs.mkdirSync(data, { recursive: true });
  app.setPath('userData', data);
  app.setPath('sessionData', data);
} catch {
  dialog.showErrorBox(`${productName} cannot start`, `Move ${productName} to a writable folder and try again.`);
  app.exit(1);
}
protocol.registerSchemesAsPrivileged([{ scheme: 'untrace', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const externalHosts = new Set(['github.com', 'www.buymeacoffee.com', 'artimic.com', 'realbrain.cc']);
function openLink(url) {
  try {
    const target = new URL(url);
    if (target.protocol === 'https:' && externalHosts.has(target.hostname)) shell.openExternal(url);
  } catch {}
}
app.whenReady().then(() => {
  require('./output.cjs').registerOutput({ ipcMain, dialog, BrowserWindow });
  const root = path.join(app.getAppPath(), 'dist');
  protocol.handle('untrace', request => {
    const url = new URL(request.url);
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (url.host !== 'app' || !file.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).href);
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_details, callback) => callback({ cancel: true }));
  const win = new BrowserWindow({
    width: 1200, height: 900, minWidth: 640, minHeight: 640,
    title: productName, show: false, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
  });
  win.removeMenu();
  win.webContents.setWindowOpenHandler(({ url }) => { openLink(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (event, url) => {
    const target = new URL(url);
    if (target.protocol !== 'untrace:' || target.host !== 'app') { event.preventDefault(); openLink(url); }
  });
  win.once('ready-to-show', () => { if (!process.env.UNTRACE_TEST) win.show(); });
  win.loadURL('untrace://app/');
});
app.on('window-all-closed', () => app.quit());
