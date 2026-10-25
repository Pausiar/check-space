import fs from 'fs'
import os from 'os'
import path from 'path'
import { DirNode, FileEntry, FLAG_HARDLINK, FLAG_LOCKED, addTotals } from './tree'
import { runPowerShell } from './platform'

const STAT_BATCH = 64
const MAX_LOCKED_RESOLVE = 20000

/**
 * Parallel directory scanner.
 *
 * - Directories are processed by a pool of workers (depth-first) and totals are
 *   propagated to every ancestor as soon as a directory's files are measured,
 *   so partial results are always consistent.
 * - Uses lstat: symlinks and junctions are never followed (no loops, no double
 *   counting) while other reparse points (OneDrive placeholders, deduplicated
 *   files...) are measured like regular entries.
 * - Hard links are counted once.
 * - Files that cannot be stat'ed because Windows keeps them open (pagefile.sys,
 *   hiberfil.sys...) are resolved afterwards through the shell.
 */
export class Scanner {
  constructor(rootPath, { concurrency = 12, clusterSize = 4096, rootName } = {}) {
    this.rootPath = rootPath
    this.concurrency = concurrency
    this.clusterSize = clusterSize || 4096
    this.cancelled = false
    this.root = new DirNode(rootName || path.basename(rootPath) || rootPath, null, rootPath)
    this.seenInodes = new Set()
    this.rootDev = null
    this.locked = []
    this.links = 0
    this.currentFolder = rootPath
    this.phase = 'scanning'
  }

  cancel() {
    this.cancelled = true
  }

  get stats() {
    return {
      files: this.root.fileCount,
      dirs: this.root.dirCount,
      size: this.root.size,
      alloc: this.root.alloc,
      links: this.links,
      locked: this.locked.length,
      currentFolder: this.currentFolder
    }
  }

  async run() {
    // `du -x` semantics on Linux: never cross into another mounted filesystem.
    // Otherwise scanning / would walk /proc, /sys, /dev and every USB stick,
    // reporting pseudo files as real data and double-counting other mounts.
    if (process.platform === 'linux') {
      try {
        this.rootDev = (await fs.promises.stat(this.rootPath)).dev
      } catch {
        this.rootDev = null
      }
    }
    const stack = [this.root]
    let active = 0
    await new Promise((resolve) => {
      const pump = () => {
        while (!this.cancelled && active < this.concurrency && stack.length) {
          const node = stack.pop()
          active++
          this._scanDir(node, stack)
            .catch(() => {})
            .finally(() => {
              active--
              pump()
            })
        }
        if (active === 0 && (stack.length === 0 || this.cancelled)) resolve()
      }
      pump()
    })
    if (!this.cancelled) {
      this.phase = 'finalizing'
      await this._resolveLocked().catch(() => {})
    }
    return this.root
  }

  _allocFor(stat) {
    if (typeof stat.blocks === 'number') return stat.blocks * 512
    return Math.ceil(stat.size / this.clusterSize) * this.clusterSize
  }

  async _scanDir(node, stack) {
    if (this.cancelled) return
    this.currentFolder = node.path

    let entries
    try {
      entries = await fs.promises.readdir(node.path, { withFileTypes: true })
    } catch (err) {
      node.error = err.code || 'ERROR'
      return
    }

    const toStat = []
    const dirEntries = []
    for (const entry of entries) {
      if (entry.isDirectory()) dirEntries.push(entry)
      // Regular files plus anything Windows reports as a reparse point
      // (OneDrive files, dedup files, symlinks...). lstat sorts them out.
      else toStat.push(entry.name)
    }

    let newDirs = 0
    // On Linux a directory entry can be a mount point of another filesystem.
    // lstat it before adding it to the tree; skipping it keeps the scan inside
    // the selected volume and avoids both double counting and pseudo files.
    if (process.platform === 'linux' && this.rootDev != null) {
      for (let i = 0; i < dirEntries.length; i += STAT_BATCH) {
        const batch = dirEntries.slice(i, i + STAT_BATCH)
        const checks = await Promise.all(
          batch.map(async (entry) => {
            try {
              const stat = await fs.promises.lstat(path.join(node.path, entry.name))
              return stat.dev === this.rootDev ? entry : null
            } catch {
              // Let the directory scan report permission/IO errors normally.
              return entry
            }
          })
        )
        for (const entry of checks) {
          if (!entry) continue
          const child = new DirNode(entry.name, node, path.join(node.path, entry.name))
          node.children.push(child)
          stack.push(child)
          newDirs++
        }
      }
    } else {
      for (const entry of dirEntries) {
        const child = new DirNode(entry.name, node, path.join(node.path, entry.name))
        node.children.push(child)
        stack.push(child)
        newDirs++
      }
    }
    if (newDirs) addTotals(node, 0, 0, 0, newDirs)

    let size = 0
    let alloc = 0
    let count = 0
    let mtime = node.mtime

    for (let i = 0; i < toStat.length; i += STAT_BATCH) {
      if (this.cancelled) break
      const batch = toStat.slice(i, i + STAT_BATCH)
      const results = await Promise.all(
        batch.map((name) => {
          const full = path.join(node.path, name)
          return fs.promises.lstat(full).then(
            (stat) => this._withInode(full, stat).then((key) => ({ name, stat, key })),
            (err) => ({ name, err })
          )
        })
      )

      for (const r of results) {
        if (r.err) {
          if (r.err.code !== 'ENOENT' && this.locked.length < MAX_LOCKED_RESOLVE) {
            this.locked.push({ node, name: r.name })
          }
          continue
        }
        const { stat } = r
        if (stat.isSymbolicLink()) {
          this.links++
          continue
        }
        if (stat.isDirectory()) {
          // Directory reparse point that is not a link (e.g. OneDrive folder)
          const child = new DirNode(r.name, node, path.join(node.path, r.name))
          node.children.push(child)
          stack.push(child)
          addTotals(node, 0, 0, 0, 1)
          continue
        }
        if (!stat.isFile()) continue

        let flags = 0
        if (r.key) {
          if (this.seenInodes.has(r.key)) flags |= FLAG_HARDLINK
          else this.seenInodes.add(r.key)
        }
        const fileAlloc = this._allocFor(stat)
        node.files.push(new FileEntry(r.name, stat.size, fileAlloc, stat.mtimeMs, flags))
        count++
        if (!(flags & FLAG_HARDLINK)) {
          size += stat.size
          alloc += fileAlloc
        }
        if (stat.mtimeMs > mtime) mtime = stat.mtimeMs
      }
    }

    node.mtime = mtime
    if (count) addTotals(node, size, alloc, count, 0)
  }

  async _withInode(full, stat) {
    if (!stat.isFile() || !(stat.nlink > 1)) return null
    try {
      // bigint stat: Windows file IDs do not fit in a double
      const b = await fs.promises.lstat(full, { bigint: true })
      return `${b.dev}:${b.ino}`
    } catch {
      return null
    }
  }

  async _resolveLocked() {
    if (process.platform !== 'win32' || this.locked.length === 0) return
    const tmp = path.join(os.tmpdir(), `checkspace-locked-${process.pid}-${Date.now()}.txt`)
    const paths = this.locked.map((l) => path.join(l.node.path, l.name))
    await fs.promises.writeFile(tmp, paths.join('\n'), 'utf8')
    try {
      // Get-Item reads directory metadata, so it works on files kept open by the system
      const script =
        `Get-Content -Encoding UTF8 -LiteralPath '${tmp.replace(/'/g, "''")}' | ForEach-Object { ` +
        '$i = Get-Item -Force -LiteralPath $_ -ErrorAction SilentlyContinue; ' +
        'if ($i -and -not $i.PSIsContainer) { "{0}|{1}|{2}" -f $i.Length, $i.LastWriteTimeUtc.ToFileTimeUtc(), $i.FullName } }'
      const out = await runPowerShell(script, { timeout: 180000 })
      const byPath = new Map()
      for (const line of out.split(/\r?\n/)) {
        const m = /^(\d+)\|(\d+)\|(.*)$/.exec(line.trim())
        if (m) byPath.set(m[3].toLowerCase(), { size: Number(m[1]), fileTime: Number(m[2]) })
      }
      for (let i = 0; i < this.locked.length; i++) {
        const info = byPath.get(paths[i].toLowerCase())
        if (!info) continue
        const { node, name } = this.locked[i]
        const alloc = Math.ceil(info.size / this.clusterSize) * this.clusterSize
        const mtime = info.fileTime / 10000 - 11644473600000
        node.files.push(new FileEntry(name, info.size, alloc, mtime, FLAG_LOCKED))
        addTotals(node, info.size, alloc, 1, 0)
      }
    } finally {
      fs.promises.unlink(tmp).catch(() => {})
    }
  }
}
