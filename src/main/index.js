const { app, BrowserWindow, ipcMain, shell } = require('electron')
const { join } = require('path')
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// ============================================
// Drive Detection
// ============================================

function getDrives() {
  const cmd = `powershell -NoProfile -Command "Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 } | Select-Object DeviceID, VolumeName, Size, FreeSpace, FileSystem | ConvertTo-Json"`
  const output = execSync(cmd, { encoding: 'utf8' })
  const disks = JSON.parse(output)
  const diskArray = Array.isArray(disks) ? disks : [disks]

  return diskArray.map(disk => ({
    letter: disk.DeviceID.replace(':', ''),
    path: disk.DeviceID + '\\',
    label: disk.VolumeName || '',
    totalSize: disk.Size,
    freeSpace: disk.FreeSpace,
    usedSpace: disk.Size - disk.FreeSpace,
    fileSystem: disk.FileSystem
  }))
}

// ============================================
// Disk Scanner
// ============================================

class DiskScanner {
  constructor(rootPath, options = {}) {
    this.rootPath = rootPath
    this.maxDepth = options.maxDepth ?? 8
    this.cancelled = false
    this.stats = {
      foldersScanned: 0,
      filesFound: 0,
      totalSize: 0,
      currentFolder: ''
    }
    this.tree = {
      name: path.basename(rootPath) || rootPath,
      path: rootPath,
      size: 0,
      children: []
    }
    this.largestFiles = [] // top 50 largest files
    this.fileTypes = {}    // extension -> { count, totalSize }
    this.oldFiles = []     // files not modified in 1+ year
    this.fileHashes = new Map() // size -> [{path, name, size}] for duplicate detection
    this.onProgress = null
    this.onComplete = null
    this.lastUpdateTime = 0
    this.UPDATE_INTERVAL_MS = 250
    this.FILE_STAT_BATCH_SIZE = 50
    this.ONE_YEAR_AGO = Date.now() - (365 * 24 * 60 * 60 * 1000)
  }

  cancel() {
    this.cancelled = true
  }

  async scan() {
    await this._scanDir(this.rootPath, this.tree, 0)
    if (!this.cancelled && this.onComplete) {
      // Find duplicates: groups of files with same size, then verify by partial hash
      const duplicates = await this._findDuplicates()
      this.onComplete(this.tree, { ...this.stats }, {
        largestFiles: this.largestFiles.sort((a, b) => b.size - a.size).slice(0, 50),
        fileTypes: this._getTopFileTypes(),
        oldFiles: this.oldFiles.sort((a, b) => a.modifiedAt - b.modifiedAt).slice(0, 50),
        duplicates
      })
    }
  }

  _insertLargestFile(fileInfo) {
    this.largestFiles.push(fileInfo)
    if (this.largestFiles.length > 60) {
      this.largestFiles.sort((a, b) => b.size - a.size)
      this.largestFiles.length = 50
    }
  }

  _trackFileType(ext, size) {
    if (!this.fileTypes[ext]) {
      this.fileTypes[ext] = { ext, count: 0, totalSize: 0 }
    }
    this.fileTypes[ext].count++
    this.fileTypes[ext].totalSize += size
  }

  _getTopFileTypes() {
    return Object.values(this.fileTypes)
      .sort((a, b) => b.totalSize - a.totalSize)
      .slice(0, 20)
  }

  async _findDuplicates() {
    const duplicates = []
    for (const [, files] of this.fileHashes) {
      if (this.cancelled) break
      if (files.length < 2) continue
      // Group by partial hash (first 4KB)
      const hashGroups = new Map()
      for (const file of files) {
        try {
          const fd = await fs.promises.open(file.path, 'r')
          const buf = Buffer.alloc(4096)
          await fd.read(buf, 0, 4096, 0)
          await fd.close()
          const hash = crypto.createHash('md5').update(buf).digest('hex')
          if (!hashGroups.has(hash)) hashGroups.set(hash, [])
          hashGroups.get(hash).push(file)
        } catch {
          // skip unreadable
        }
      }
      for (const [, group] of hashGroups) {
        if (group.length >= 2) {
          duplicates.push({
            size: group[0].size,
            count: group.length,
            wastedSpace: group[0].size * (group.length - 1),
            files: group.map(f => ({ path: f.path, name: f.name }))
          })
        }
      }
    }
    return duplicates.sort((a, b) => b.wastedSpace - a.wastedSpace).slice(0, 30)
  }

  async _scanDir(dirPath, node, depth) {
    if (this.cancelled) return 0

    this.stats.foldersScanned++
    this.stats.currentFolder = dirPath

    let entries
    try {
      entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
    } catch {
      return 0
    }

    const files = []
    const dirs = []
    for (const entry of entries) {
      if (entry.isFile()) {
        files.push(entry.name)
      } else if (entry.isDirectory() && !entry.isSymbolicLink()) {
        dirs.push(entry.name)
      }
    }

    let fileSize = 0
    for (let i = 0; i < files.length; i += this.FILE_STAT_BATCH_SIZE) {
      if (this.cancelled) break
      const batch = files.slice(i, i + this.FILE_STAT_BATCH_SIZE)
      const results = await Promise.allSettled(
        batch.map(name => fs.promises.stat(path.join(dirPath, name)).then(s => ({ name, stat: s })))
      )
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { name, stat } = result.value
          const size = stat.size
          fileSize += size
          this.stats.filesFound++
          this.stats.totalSize += size

          const filePath = path.join(dirPath, name)
          const ext = path.extname(name).toLowerCase() || '(no ext)'

          // Track largest files
          this._insertLargestFile({ name, path: filePath, size, modifiedAt: stat.mtimeMs })

          // Track file types
          this._trackFileType(ext, size)

          // Track old files
          if (stat.mtimeMs < this.ONE_YEAR_AGO) {
            this.oldFiles.push({ name, path: filePath, size, modifiedAt: stat.mtimeMs })
            if (this.oldFiles.length > 60) {
              this.oldFiles.sort((a, b) => a.modifiedAt - b.modifiedAt)
              this.oldFiles.length = 50
            }
          }

          // Track potential duplicates (by size, only for files > 1KB)
          if (size > 1024) {
            const sizeKey = size.toString()
            if (!this.fileHashes.has(sizeKey)) this.fileHashes.set(sizeKey, [])
            const group = this.fileHashes.get(sizeKey)
            if (group.length < 10) { // limit per size group
              group.push({ name, path: filePath, size })
            }
          }
        }
      }
    }

    let dirSize = fileSize

    for (const dirName of dirs) {
      if (this.cancelled) break

      const fullPath = path.join(dirPath, dirName)
      let childNode = null

      if (depth < this.maxDepth) {
        childNode = { name: dirName, path: fullPath, size: 0, children: [] }
        node.children.push(childNode)
      }

      const childSize = await this._scanDir(
        fullPath,
        childNode || { name: dirName, path: fullPath, size: 0, children: [] },
        depth + 1
      )

      dirSize += childSize
      if (childNode) {
        childNode.size = childSize
      }

      this._maybeSendProgress()
    }

    node.size = dirSize
    return dirSize
  }

  _maybeSendProgress() {
    const now = Date.now()
    if (now - this.lastUpdateTime >= this.UPDATE_INTERVAL_MS && this.onProgress) {
      const snapshot = this._getTreeSnapshot(this.tree, 2)
      this.onProgress(snapshot, { ...this.stats })
      this.lastUpdateTime = now
    }
  }

  _getTreeSnapshot(node, maxDepth, currentDepth = 0) {
    const snap = { name: node.name, path: node.path, size: node.size }
    if (currentDepth < maxDepth && node.children && node.children.length > 0) {
      snap.children = node.children
        .filter(c => c.size > 0)
        .sort((a, b) => b.size - a.size)
        .slice(0, 20)
        .map(child => this._getTreeSnapshot(child, maxDepth, currentDepth + 1))
    }
    return snap
  }
}

// ============================================
// Electron App
// ============================================

let mainWindow
let activeScanner = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 780,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#F9F9F8',
      symbolColor: '#1A1A1A',
      height: 40
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.on('theme:set', (_event, isDark) => {
  if (mainWindow) {
    mainWindow.setTitleBarOverlay({
      color: isDark ? '#181818' : '#F9F9F8',
      symbolColor: isDark ? '#E4E4E4' : '#1A1A1A'
    })
  }
})

ipcMain.handle('drives:get', async () => {
  return getDrives()
})

// Open folder/file in Windows Explorer
ipcMain.handle('shell:openPath', async (_event, targetPath) => {
  try {
    await shell.openPath(targetPath)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// Show file in Explorer (select it)
ipcMain.handle('shell:showItemInFolder', async (_event, targetPath) => {
  try {
    shell.showItemInFolder(targetPath)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// Delete file or folder (move to trash)
ipcMain.handle('fs:moveToTrash', async (_event, targetPath) => {
  try {
    await shell.trashItem(targetPath)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// Cache management
const CACHE_DIR = path.join(app.getPath('userData'), 'scan-cache')

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
  }
}

ipcMain.handle('cache:save', async (_event, driveLetter, data) => {
  try {
    ensureCacheDir()
    const filePath = path.join(CACHE_DIR, `${driveLetter}.json`)
    await fs.promises.writeFile(filePath, JSON.stringify(data), 'utf8')
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('cache:load', async (_event, driveLetter) => {
  try {
    const filePath = path.join(CACHE_DIR, `${driveLetter}.json`)
    if (!fs.existsSync(filePath)) return null
    const raw = await fs.promises.readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
})

ipcMain.handle('scan:start', async (_event, drivePath) => {
  if (activeScanner) {
    activeScanner.cancel()
  }

  // Find drive info to get usedSpace for progress estimation
  let driveUsedSpace = 0
  try {
    const drives = getDrives()
    const drv = drives.find(d => d.path === drivePath)
    if (drv) driveUsedSpace = drv.usedSpace
  } catch {}

  activeScanner = new DiskScanner(drivePath, { maxDepth: 8 })

  activeScanner.onProgress = (tree, stats) => {
    const progress = driveUsedSpace > 0 ? Math.min(0.99, stats.totalSize / driveUsedSpace) : 0
    mainWindow?.webContents.send('scan:progress', { tree, stats, progress })
  }

  activeScanner.onComplete = (tree, stats, extras) => {
    mainWindow?.webContents.send('scan:complete', { tree, stats, extras })
    activeScanner = null
  }

  try {
    await activeScanner.scan()
  } catch (err) {
    mainWindow?.webContents.send('scan:error', { message: err.message })
    activeScanner = null
  }
})

ipcMain.on('scan:cancel', () => {
  if (activeScanner) {
    activeScanner.cancel()
    activeScanner = null
  }
})

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
