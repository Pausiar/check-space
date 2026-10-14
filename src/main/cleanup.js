import path from 'path'
import os from 'os'
import { lookup, walkDirs } from './tree'

/**
 * Cleanup suggestions are derived from the scanned tree, so sizes are only
 * reported for locations inside the scanned root.
 *
 * action:
 *   'clearContents'  delete everything inside the folder (permanent)
 *   'emptyRecycleBin' empty the recycle bin of the drive
 *   'trash'          move the folder itself to the recycle bin
 */

function env(name) {
  return process.env[name] || ''
}

function candidates() {
  if (process.platform !== 'win32') {
    return [
      { id: 'tmp', kind: 'temp', path: os.tmpdir(), action: 'clearContents', risk: 'safe' },
      { id: 'cache', kind: 'userCache', path: path.join(os.homedir(), '.cache'), action: 'clearContents', risk: 'caution' }
    ]
  }
  const sysRoot = env('SystemRoot') || 'C:\\Windows'
  const sysDrive = env('SystemDrive') || 'C:'
  const local = env('LOCALAPPDATA')
  const list = [
    { id: 'userTemp', kind: 'temp', path: os.tmpdir(), action: 'clearContents', risk: 'safe' },
    { id: 'winTemp', kind: 'winTemp', path: path.join(sysRoot, 'Temp'), action: 'clearContents', risk: 'safe' },
    { id: 'wuCache', kind: 'windowsUpdate', path: path.join(sysRoot, 'SoftwareDistribution', 'Download'), action: 'clearContents', risk: 'safe' },
    { id: 'windowsOld', kind: 'windowsOld', path: path.join(sysDrive + '\\', 'Windows.old'), action: 'trash', risk: 'caution' },
    { id: 'minidump', kind: 'crashDumps', path: path.join(sysRoot, 'Minidump'), action: 'clearContents', risk: 'safe' },
    { id: 'deliveryOpt', kind: 'deliveryOptimization', path: path.join(sysRoot, 'ServiceProfiles', 'NetworkService', 'AppData', 'Local', 'Microsoft', 'Windows', 'DeliveryOptimization', 'Cache'), action: 'clearContents', risk: 'safe' }
  ]
  if (local) {
    list.push(
      { id: 'crashDumps', kind: 'crashDumps', path: path.join(local, 'CrashDumps'), action: 'clearContents', risk: 'safe' },
      { id: 'thumbs', kind: 'thumbnails', path: path.join(local, 'Microsoft', 'Windows', 'Explorer'), action: 'clearContents', risk: 'safe' },
      { id: 'inetCache', kind: 'browserCache', label: 'Internet Explorer / WebView', path: path.join(local, 'Microsoft', 'Windows', 'INetCache'), action: 'clearContents', risk: 'safe' }
    )
  }
  return list
}

// Browser profile caches: <User Data>\<profile>\{Cache, Code Cache, GPUCache}
function browserCaches(root) {
  const local = env('LOCALAPPDATA')
  if (!local) return []
  const browsers = [
    ['Google Chrome', path.join(local, 'Google', 'Chrome', 'User Data')],
    ['Microsoft Edge', path.join(local, 'Microsoft', 'Edge', 'User Data')],
    ['Brave', path.join(local, 'BraveSoftware', 'Brave-Browser', 'User Data')],
    ['Opera', path.join(env('APPDATA'), 'Opera Software', 'Opera Stable')]
  ]
  const out = []
  for (const [label, dataDir] of browsers) {
    const found = lookup(root, dataDir)
    if (!found || found.file) continue
    const profiles = [found.dir, ...found.dir.children]
    for (const profile of profiles) {
      for (const cacheName of ['Cache', 'Code Cache', 'GPUCache']) {
        const c = profile.children.find((d) => d.name === cacheName)
        if (c && c.size > 0) {
          out.push({ id: `browser:${c.path}`, kind: 'browserCache', label, path: c.path, action: 'clearContents', risk: 'safe' })
        }
      }
    }
  }
  const ff = lookup(root, path.join(local, 'Mozilla', 'Firefox', 'Profiles'))
  if (ff && !ff.file) {
    for (const profile of ff.dir.children) {
      const c = profile.children.find((d) => d.name === 'cache2')
      if (c && c.size > 0) out.push({ id: `browser:${c.path}`, kind: 'browserCache', label: 'Firefox', path: c.path, action: 'clearContents', risk: 'safe' })
    }
  }
  return out
}

function nodeModules(root) {
  const found = []
  walkDirs(root, (dir) => {
    if (dir.name === 'node_modules' && dir !== root) {
      found.push(dir)
      return false // do not look for nested node_modules
    }
    return true
  })
  return found
    .sort((a, b) => b.size - a.size)
    .slice(0, 30)
    .filter((d) => d.size > 10 * 1024 * 1024)
    .map((d) => ({ id: `nm:${d.path}`, kind: 'nodeModules', path: d.path, action: 'trash', risk: 'caution' }))
}

function recycleBin(root) {
  if (process.platform !== 'win32') return []
  const drive = path.parse(root.path).root
  const bin = lookup(root, path.join(drive, '$Recycle.Bin'))
  if (!bin || bin.file) return []
  return [{ id: 'recycleBin', kind: 'recycleBin', path: bin.dir.path, action: 'emptyRecycleBin', risk: 'safe', drive: drive.slice(0, 1) }]
}

export function getSuggestions(root) {
  if (!root) return []
  const all = [...recycleBin(root), ...candidates(), ...browserCaches(root), ...nodeModules(root)]
  const seen = new Set()
  const out = []
  for (const c of all) {
    const found = lookup(root, c.path)
    if (!found || found.file) continue
    const key = found.dir.path.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    if (found.dir.size <= 0) continue
    out.push({
      ...c,
      path: found.dir.path,
      size: found.dir.size,
      alloc: found.dir.alloc,
      files: found.dir.fileCount
    })
  }
  return out.sort((a, b) => b.size - a.size)
}

export function findSuggestion(root, id) {
  return getSuggestions(root).find((s) => s.id === id) || null
}
