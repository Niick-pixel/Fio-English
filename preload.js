// Puente seguro entre la interfaz y el proceso principal.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadStore: () => ipcRenderer.invoke('store:load'),
  saveStore: (data) => ipcRenderer.invoke('store:save', data),
  loadContent: (name) => ipcRenderer.invoke('content:load', name),
  paths: () => ipcRenderer.invoke('app:paths'),
  openPath: (which) => ipcRenderer.invoke('app:openPath', which),
  platform: process.platform,
});
