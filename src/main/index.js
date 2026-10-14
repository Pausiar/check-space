// More libuv threads: the scanner keeps many lstat/readdir calls in flight.
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '16'

import { app, BrowserWindow, ipcMain, shell, dialog, nativeTheme } from 'electron'
import { join } from 'path'
import path from 'path'
import fs from 'fs'
import { Scanner } from './scanner'
import { buildView, lookup, removeDir, removeFile, replaceContents, summarize, search } from './tree'
import { getDrives, diskUsage, isDriveRoot, isAdmin, relaunchAsAdmin, emptyRecycleBin } from './platform'
import { initCache, saveCache, loadCache, hasCache } from './cache'
import { findDuplicates } from './duplicates'
import { getSuggestions, findSuggestion } from './cleanup'
import { writeCsv, writeJson } from './report'

let mainWindow = null

// ============================================
// Current scan state (single active root)
// ============================================

const state = {
  scanId: 0,
  scanner: null,
  root: null,
  meta: null, // see makeMeta()
  version: 0, // bumped on every mutation of the tree
  summaryCache: null,
  dupes: null // { ctl }
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload)
}

function makeMeta(root, extra) {
  const drive = extra.drive || null
  let unaccounted = 0
  if (extra.isDrive && drive && extra.complete) {
    // Space used on the volume that no readable file explains: NTFS metadata,
    // shadow copies, protected folders...
    unaccounted = Math.max(0, drive.used - root.alloc)
  }
  return {
    rootPath: root.path,
    rootName: root.name,
    isDrive: extra.isDrive,
    complete: extra.complete,
    cancelled: !!extra.cancelled,
    fromCache: !!extra.fromCache,
    savedAt: extra.savedAt || Date.now(),
    drive,
    unaccounted,
    stats: {
      files: root.fileCount,
      dirs: root.dirCount,
      size: root.size,
      alloc: root.alloc,
      links: extra.links || 0,
      locked: extra.locked || 0
    },
    version: state.version
  }
}

function refreshMeta() {
  if (!state.root || !state.meta) return null
  state.version++
  state.summaryCache = null
  state.meta = makeMeta(state.root, { ...state.meta, links: state.meta.stats.links, locked: state.meta.stats.locked })
  return state.meta
}

function systemEntry(meta) {
  if (!meta || meta.unaccounted <= 0) return null
  return {
    type: 'system',
    name: '',
    path: meta.rootPath + '\u0000system',
    size: meta.unaccounted,
    alloc: meta.unaccounted
  }
}

let cacheSaveTimer = null
function scheduleCacheSave() {
  if (!state.root || !state.meta?.complete) return
  clearTimeout(cacheSaveTimer)
  const root = state.root
  cacheSaveTimer = setTimeout(() => {
    if (state.root === root) saveCache(root, state.meta).catch(() => {})
  }, 1500)
}

// ============================================
// Scanning
// ============================================

async function startScan(rootPath) {
  if (state.scanner) state.scanner.cancel()
  cancelDuplicates()

  const scanId = ++state.scanId
  const resolved = path.resolve(rootPath)
  const isDrive = isDriveRoot(resolved)

  let drive = null
  try {
    const usage = await diskUsage(resolved)
    drive = { total: usage.total, free: usage.free, used: usage.used, clusterSize: usage.clusterSize }
  } catch {
    // unknown volume info: progress becomes indeterminate
  }

  const rootName = isDrive ? resolved.replace(/[\\/]+$/, '') || resolved : path.basename(resolved)
  const scanner = new Scanner(resolved, { clusterSize: drive?.clusterSize, rootName })
  state.scanner = scanner
  state.root = scanner.root
  state.meta = null
  state.version++
  state.summaryCache = null

  const isCurrent = () => state.scanner === scanner && state.scanId === scanId

  const progress = () => {
    if (!isCurrent()) return
    const stats = scanner.stats
    let fraction = null
    if (isDrive && drive && drive.used > 0) fraction = Math.min(0.99, stats.alloc / drive.used)
    send('scan:progress', {
      scanId,
      phase: scanner.phase,
      stats,
      progress: scanner.phase === 'finalizing' ? 0.99 : fraction,
      view: buildView(scanner.root, { depth: 2, maxChildren: 40, includeFiles: false })
    })
  }
  const timer = setInterval(progress, 300)
  progress()

  try {
    await scanner.run()
  } catch (err) {
    clearInterval(timer)
    if (isCurrent()) {
      state.scanner = null
      send('scan:error', { scanId, message: err.message })
    }
    return { scanId }
  }
  clearInterval(timer)
  if (!isCurrent()) return { scanId }

  state.scanner = null
  const complete = !scanner.cancelled
  if (complete && drive) {
    // Refresh usage: the disk may have changed during a long scan
    try {
      const u = await diskUsage(resolved)
      drive = { total: u.total, free: u.free, used: u.used, clusterSize: u.clusterSize }
    } catch {}
  }
  state.meta = makeMeta(scanner.root, {
    isDrive,
    drive,
    complete,
    cancelled: scanner.cancelled,
    links: scanner.links,
    locked: scanner.locked.length
  })
  state.version++
  send('scan:complete', { scanId, meta: state.meta })
  // Only complete scans are cached, so a cancelled scan never masquerades as a full one
  if (complete) saveCache(scanner.root, state.meta).catch(() => {})
  return { scanId }
}

function cancelScan() {
  const scanner = state.scanner
  if (scanner) scanner.cancel()
  // run() resolves shortly after and emits scan:complete with cancelled: true
}

// ============================================
// Rescan one folder in place (after cleanups)
// ============================================

async function rescanSubtree(dirNode) {
  const scanner = new Scanner(dirNode.path, {
    clusterSize: state.meta?.drive?.clusterSize,
    rootName: dirNode.name
  })
  const fresh = await scanner.run()
  if (lookup(state.root, dirNode.path)?.dir === dirNode) replaceContents(dirNode, fresh)
}

// ============================================
// Deletion
// ============================================

function isProtectedPath(p) {
  const resolved = path.resolve(p)
  if (isDriveRoot(resolved)) return true
  if (process.platform === 'win32') {
    const low = resolved.toLowerCase().replace(/[\\/]+$/, '')
    const sysRoot = (process.env.SystemRoot || 'C:\\Windows').toLowerCase()
    const protectedDirs = [
      sysRoot,
      path.join(sysRoot, 'system32').toLowerCase(),
      (process.env.ProgramFiles || 'C:\\Program Files').toLowerCase(),
      (process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)').toLowerCase(),
      (process.env.ProgramData || 'C:\\ProgramData').toLowerCase(),
      path.join(path.parse(resolved).root, 'Users').toLowerCase(),
      (process.env.USERPROFILE || '').toLowerCase()
    ].filter(Boolean)
    if (protectedDirs.includes(low)) return true
    const name = path.basename(low)
    if (['pagefile.sys', 'hiberfil.sys', 'swapfile.sys', 'bootmgr', '$recycle.bin', 'system volume information'].includes(name)) return true
  }
  return false
}

async function deletePaths(paths, { permanent = false } = {}) {
  const results = []
  let freed = 0
  if (!state.root || !Array.isArray(paths)) return { results, freed }

  for (const p of paths.slice(0, 10000)) {
    if (typeof p !== 'string') continue
    // Only entries that belong to the current scan can be deleted
    const found = lookup(state.root, p)
    if (!found) {
      results.push({ path: p, ok: false, error: 'NOT_IN_SCAN' })
      continue
    }
    if (isProtectedPath(p)) {
      results.push({ path: p, ok: false, error: 'PROTECTED' })
      continue
    }
    const target = found.file ? path.join(found.dir.path, found.file.name) : found.dir.path
    try {
      if (permanent) await fs.promises.rm(target, { recursive: true, force: false, maxRetries: 2 })
      else await shell.trashItem(target)
      const size = found.file ? found.file.size : found.dir.size
      if (found.file) removeFile(found.dir, found.file)
      else removeDir(found.dir)
      freed += size
      results.push({ path: p, ok: true, size })
    } catch (err) {
      results.push({ path: p, ok: false, error: err.code || err.message })
    }
  }
  const meta = refreshMeta()
  scheduleCacheSave()
  return { results, freed, permanent, meta }
}

async function runCleanup(id) {
  if (!state.root) return { ok: false, error: 'NO_SCAN' }
  const s = findSuggestion(state.root, id)
  if (!s) return { ok: false, error: 'NOT_FOUND' }
  const found = lookup(state.root, s.path)
  if (!found || found.file) return { ok: false, error: 'NOT_FOUND' }
  const node = found.dir
  const before = node.size
  let failed = 0

  try {
    if (s.action === 'emptyRecycleBin') {
      await emptyRecycleBin(s.drive)
      await rescanSubtree(node)
    } else if (s.action === 'trash') {
      await shell.trashItem(node.path)
      removeDir(node)
    } else if (s.action === 'clearContents') {
      const entries = [...node.children.map((c) => c.path), ...node.files.map((f) => path.join(node.path, f.name))]
      for (const e of entries) {
        try {
          await fs.promises.rm(e, { recursive: true, force: true, maxRetries: 1 })
        } catch {
          failed++ // files in use are expected in temp folders
        }
      }
      await rescanSubtree(node)
    }
  } catch (err) {
    return { ok: false, error: err.code || err.message }
  }

  const after = lookup(state.root, s.path)?.dir?.size || 0
  const meta = refreshMeta()
  scheduleCacheSave()
  return { ok: true, freed: Math.max(0, before - after), failed, meta }
}

// ============================================
// Duplicates
// ============================================

function cancelDuplicates() {
  if (state.dupes) state.dupes.ctl.cancelled = true
  state.dupes = null
}

async function runDuplicates(opts = {}) {
  if (!state.root) return null
  cancelDuplicates()
  const ctl = { cancelled: false }
  const job = { ctl }
  state.dupes = job
  const minSize = Math.max(1, Number(opts.minSize) || 1024 * 1024)
  const result = await findDuplicates(state.root, {
    minSize,
    ctl,
    onProgress: (p) => {
      if (state.dupes === job) send('dupes:progress', p)
    }
  })
  if (state.dupes === job) state.dupes = null
  if (!result) return { cancelled: true }
  return result
}

// ============================================
// Window
// ============================================

const TITLEBAR_HEIGHT = 40

function createWindow() {
  const dark = nativeTheme.shouldUseDarkColors
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 820,
    minHeight: 600,
    title: 'Check Space',
    backgroundColor: dark ? '#181818' : '#F9F9F8',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: dark ? '#181818' : '#F9F9F8',
      symbolColor: dark ? '#E4E4E4' : '#1A1A1A',
      height: TITLEBAR_HEIGHT
    },
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Never navigate away from the app or open new windows
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (url !== mainWindow.webContents.getURL()) e.preventDefault()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ============================================
// IPC
// ============================================

function isTrustedSender(event) {
  const url = event.senderFrame?.url || ''
  if (url.startsWith('file://')) return true
  const devUrl = process.env.ELECTRON_RENDERER_URL
  return !!devUrl && url.startsWith(devUrl)
}

function handle(channel, fn) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted sender')
    return fn(...args)
  })
}

function on(channel, fn) {
  ipcMain.on(channel, (event, ...args) => {
    if (isTrustedSender(event)) fn(...args)
  })
}

on('theme:set', (isDark) => {
  if (!mainWindow) return
  try {
    mainWindow.setTitleBarOverlay({
      color: isDark ? '#181818' : '#F9F9F8',
      symbolColor: isDark ? '#E4E4E4' : '#1A1A1A'
    })
    mainWindow.setBackgroundColor(isDark ? '#181818' : '#F9F9F8')
  } catch {
    // setTitleBarOverlay is not available on every platform
  }
})

handle('drives:get', async () => {
  try {
    const drives = await getDrives()
    await Promise.all(
      drives.map(async (d) => {
        d.cachedAt = await hasCache(d.path)
      })
    )
    return { drives }
  } catch (err) {
    return { drives: [], error: err.message }
  }
})

handle('dialog:pickFolder', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
  if (r.canceled || !r.filePaths[0]) return null
  const p = r.filePaths[0]
  return { path: p, name: path.basename(p) || p, cachedAt: await hasCache(p) }
})

handle('scan:start', (rootPath) => {
  if (typeof rootPath !== 'string' || !rootPath) throw new Error('Invalid path')
  // Do not await: the renderer learns the outcome through scan:* events
  const scanId = state.scanId + 1
  startScan(rootPath).catch((err) => send('scan:error', { scanId, message: err.message }))
  return { scanId }
})

on('scan:cancel', () => cancelScan())

handle('scan:loadCache', async (rootPath) => {
  if (typeof rootPath !== 'string') return null
  const cached = await loadCache(rootPath)
  if (!cached) return null
  if (state.scanner) state.scanner.cancel()
  state.scanner = null
  cancelDuplicates()
  state.scanId++
  state.root = cached.root
  state.version++
  state.summaryCache = null
  state.meta = { ...cached.meta, fromCache: true, version: state.version }
  return { scanId: state.scanId, meta: state.meta }
})

handle('scan:meta', () => state.meta)

handle('tree:view', (targetPath, opts = {}) => {
  if (!state.root) return null
  const found = targetPath ? lookup(state.root, targetPath) : { dir: state.root }
  if (!found || found.file) return null
  const depth = Math.min(Math.max(1, Number(opts.depth) || 1), 6)
  const maxChildren = Math.min(Math.max(1, Number(opts.maxChildren) || 200), 5000)
  const metric = opts.metric === 'alloc' ? 'alloc' : 'size'
  const extra = found.dir === state.root && state.meta ? [systemEntry(state.meta)].filter(Boolean) : null
  return buildView(found.dir, { depth, maxChildren, metric, includeFiles: opts.includeFiles !== false }, extra)
})

handle('tree:summary', (opts = {}) => {
  if (!state.root) return null
  const metric = opts.metric === 'alloc' ? 'alloc' : 'size'
  const key = `${state.version}:${metric}`
  if (state.summaryCache?.key === key) return state.summaryCache.value
  const value = summarize(state.root, { metric })
  state.summaryCache = { key, value }
  return value
})

handle('tree:search', (opts = {}) => {
  if (!state.root) return { results: [], total: 0, truncated: false }
  return search(state.root, {
    query: String(opts.query || '').slice(0, 200),
    exts: Array.isArray(opts.exts) ? opts.exts.slice(0, 50).map(String) : [],
    minSize: Number(opts.minSize) || 0,
    kind: ['files', 'dirs'].includes(opts.kind) ? opts.kind : 'all',
    under: typeof opts.under === 'string' ? opts.under : null,
    metric: opts.metric === 'alloc' ? 'alloc' : 'size',
    olderThanMs: Number(opts.olderThanMs) || 0,
    limit: Math.min(Number(opts.limit) || 500, 5000)
  })
})

handle('fs:delete', (paths, opts = {}) => deletePaths(paths, { permanent: !!opts.permanent }))

handle('shell:showItemInFolder', (p) => {
  if (!state.root || !lookup(state.root, p)) return false
  shell.showItemInFolder(p)
  return true
})

handle('shell:openPath', async (p) => {
  if (!state.root) return false
  const found = lookup(state.root, p)
  if (!found || found.file) return false // only folders: never execute files
  return (await shell.openPath(found.dir.path)) === ''
})

handle('dupes:find', (opts) => runDuplicates(opts))
on('dupes:cancel', () => cancelDuplicates())

handle('cleanup:list', () => (state.root ? getSuggestions(state.root) : []))
handle('cleanup:run', (id) => runCleanup(String(id)))

handle('report:export', async (format) => {
  if (!state.root || !state.meta) return { ok: false, error: 'NO_SCAN' }
  const fmt = format === 'json' ? 'json' : 'csv'
  const base = (state.root.name || 'scan').replace(/[\\/:*?"<>|]/g, '') || 'scan'
  const stamp = new Date().toISOString().slice(0, 10)
  const r = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `check-space-${base}-${stamp}.${fmt}`,
    filters: [fmt === 'json' ? { name: 'JSON', extensions: ['json'] } : { name: 'CSV', extensions: ['csv'] }]
  })
  if (r.canceled || !r.filePath) return { ok: false, cancelled: true }
  try {
    if (fmt === 'json') await writeJson(state.root, r.filePath, state.meta)
    else await writeCsv(state.root, r.filePath)
    shell.showItemInFolder(r.filePath)
    return { ok: true, path: r.filePath }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

handle('app:info', async () => ({
  platform: process.platform,
  isAdmin: await isAdmin(),
  version: app.getVersion()
}))

handle('app:relaunchAsAdmin', async () => {
  const ok = await relaunchAsAdmin()
  if (ok) setTimeout(() => app.quit(), 300)
  return ok
})

app.whenReady().then(() => {
  initCache(app.getPath('userData'))
  createWindow()
})
app.on('window-all-closed', () => app.quit())
