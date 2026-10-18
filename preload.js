const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
  togglePin: (shouldPin) => ipcRenderer.send('window-toggle-pin', shouldPin),
  onPinStatus: (callback) => ipcRenderer.on('window-pin-status', (event, status) => callback(status)),
});
