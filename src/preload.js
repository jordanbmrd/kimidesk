'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kimi', {
  onState: (cb) => ipcRenderer.on('mascot:state', (_e, data) => cb(data)),
  onScale: (cb) => ipcRenderer.on('mascot:scale', (_e, s) => cb(s)),
  dragStart: () => ipcRenderer.send('drag:start'),
  dragEnd: () => ipcRenderer.send('drag:end'),
  openMenu: () => ipcRenderer.send('mascot:menu'),
});
