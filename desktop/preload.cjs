const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('untraceDesktop', {
  chooseOutputFolder: () => ipcRenderer.invoke('output:choose'),
  saveOutput: (token, filename, bytes) => ipcRenderer.invoke('output:save', token, filename, bytes),
});
