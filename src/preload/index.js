const { contextBridge, ipcRenderer } = require('electron')

function subscribe(channel) {
  return (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  }
}

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,

  // App
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  relaunchAsAdmin: () => ipcRenderer.invoke('app:relaunchAsAdmin'),
  setTheme: (isDark) => ipcRenderer.send('theme:set', isDark),

  // Drives / folders
  getDrives: () => ipcRenderer.invoke('drives:get'),
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),

  // Scanning
  startScan: (rootPath) => ipcRenderer.invoke('scan:start', rootPath),
  cancelScan: () => ipcRenderer.send('scan:cancel'),
  loadCache: (rootPath) => ipcRenderer.invoke('scan:loadCache', rootPath),
  getMeta: () => ipcRenderer.invoke('scan:meta'),
  onScanProgress: subscribe('scan:progress'),
  onScanComplete: subscribe('scan:complete'),
  onScanError: subscribe('scan:error'),

  // Tree queries
  getView: (path, opts) => ipcRenderer.invoke('tree:view', path, opts),
  getSummary: (opts) => ipcRenderer.invoke('tree:summary', opts),
  search: (opts) => ipcRenderer.invoke('tree:search', opts),

  // File actions
  deletePaths: (paths, opts) => ipcRenderer.invoke('fs:delete', paths, opts),
  showItemInFolder: (path) => ipcRenderer.invoke('shell:showItemInFolder', path),
  openFolder: (path) => ipcRenderer.invoke('shell:openPath', path),

  // Duplicates
  findDuplicates: (opts) => ipcRenderer.invoke('dupes:find', opts),
  cancelDuplicates: () => ipcRenderer.send('dupes:cancel'),
  onDuplicatesProgress: subscribe('dupes:progress'),

  // Cleanup suggestions
  getCleanup: () => ipcRenderer.invoke('cleanup:list'),
  runCleanup: (id) => ipcRenderer.invoke('cleanup:run', id),

  // Export
  exportReport: (format) => ipcRenderer.invoke('report:export', format),

  // Updates
  updates: {
    getState: () => ipcRenderer.invoke('update:state'),
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.send('update:install'),
    onStatus: subscribe('update:status')
  }
})
