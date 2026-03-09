const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('satlync', {
  systemCheck:       () => ipcRenderer.invoke('system-check'),
  getInterfaces:     () => ipcRenderer.invoke('get-interfaces'),
  runInstall:        (opts) => ipcRenderer.invoke('run-install', opts),
  getActivationCode: () => ipcRenderer.invoke('get-activation-code'),
  openUrl:           (url) => ipcRenderer.invoke('open-url', url),
  quit:              () => ipcRenderer.invoke('quit')
});
