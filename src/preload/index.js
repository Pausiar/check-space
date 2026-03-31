const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  getDrives: () => ipcRenderer.invoke('drives:get'),
  startScan: (drivePath) => ipcRenderer.invoke('scan:start', drivePath),
  cancelScan: () => ipcRenderer.send('scan:cancel'),

  // Shell actions
  openPath: (targetPath) => ipcRenderer.invoke('shell:openPath', targetPath),
  showItemInFolder: (targetPath) => ipcRenderer.invoke('shell:showItemInFolder', targetPath),
  moveToTrash: (targetPath) => ipcRenderer.invoke('fs:moveToTrash', targetPath),

  // Cache
  cacheSave: (driveLetter, data) => ipcRenderer.invoke('cache:save', driveLetter, data),
  cacheLoad: (driveLetter) => ipcRenderer.invoke('cache:load', driveLetter),

  // Theme
  setTheme: (isDark) => ipcRenderer.send('theme:set', isDark),

  onScanProgress: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('scan:progress', handler)
    return () => ipcRenderer.removeListener('scan:progress', handler)
  },
  onScanComplete: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('scan:complete', handler)
    return () => ipcRenderer.removeListener('scan:complete', handler)
  },
  onScanError: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('scan:error', handler)
    return () => ipcRenderer.removeListener('scan:error', handler)
  }
})
