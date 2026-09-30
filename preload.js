const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('qt', {
  load: () => ipcRenderer.sendSync('load'),
  save: j => ipcRenderer.send('save', j),
  ignore: on => ipcRenderer.send('ignore', on),
  focus: () => ipcRenderer.send('focus'),
  onCmd: f => ipcRenderer.on('cmd', (_e, c) => f(c)),
  // taskbar widget
  wsize: w => ipcRenderer.send('wsize', w),
  wclick: () => ipcRenderer.send('wclick'),
  onData: f => ipcRenderer.on('data', f),
  onTheme: f => ipcRenderer.on('theme', (_e, light) => f(light))
});
