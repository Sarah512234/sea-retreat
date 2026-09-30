const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('seaWindow', {
  hide: () => ipcRenderer.invoke('sea:hide'),
  togglePin: () => ipcRenderer.invoke('sea:pin'),
  onPinChange: (callback) => { ipcRenderer.on('sea:pin-state', (_event, pinned) => callback(pinned)); }
});
