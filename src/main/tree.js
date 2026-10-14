import path from 'path'

// ============================================
// In-memory tree model
// ============================================
// Directories are objects with a parent pointer so totals can be propagated
// upwards; files are lightweight entries stored in their parent directory.

export class DirNode {
  constructor(name, parent, fullPath) {
    this.name = name
    this.parent = parent
    this.path = fullPath
    this.size = 0 // logical size of the whole subtree
    this.alloc = 0 // size on disk of the whole subtree
    this.fileCount = 0 // files in the whole subtree
    this.dirCount = 0 // directories in the whole subtree (excluding itself)
    this.mtime = 0
    this.children = []
    this.files = []
    this.error = null // readdir error code, if the folder could not be read
  }
}

export class FileEntry {
  constructor(name, size, alloc, mtime, flags = 0) {
    this.name = name
    this.size = size
    this.alloc = alloc
    this.mtime = mtime
    this.flags = flags
  }
}

// FileEntry.flags
export const FLAG_HARDLINK = 1 // another link to this data was already counted
export const FLAG_LOCKED = 2 // size obtained via the shell because the file is in use

export const isCounted = (file) => (file.flags & FLAG_HARDLINK) === 0

export function addTotals(node, size, alloc, files, dirs) {
  for (let n = node; n; n = n.parent) {
    n.size += size
    n.alloc += alloc
    n.fileCount += files
    n.dirCount += dirs
  }
}

export function filePath(dir, file) {
  return path.join(dir.path, file.name)
}

export function extOf(name) {
  const ext = path.extname(name).toLowerCase()
  return ext || ''
}

function samePath(a, b) {
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
}

/**
 * Locate a path inside the tree.
 * Returns { dir } for directories, { dir, file, index } for files, or null.
 */
export function lookup(root, target) {
  if (!root || typeof target !== 'string' || !target) return null
  const normalized = path.resolve(target)
  const rootPath = path.resolve(root.path)
  if (samePath(normalized, rootPath)) return { dir: root }
  const rel = path.relative(rootPath, normalized)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null

  const parts = rel.split(path.sep).filter(Boolean)
  let node = root
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    const child = node.children.find((c) => samePath(c.name, part))
    if (child) {
      node = child
      continue
    }
    if (i === parts.length - 1) {
      const index = node.files.findIndex((f) => samePath(f.name, part))
      if (index >= 0) return { dir: node, file: node.files[index], index }
    }
    return null
  }
  return { dir: node }
}

export function removeDir(node) {
  const parent = node.parent
  if (!parent) return false
  const idx = parent.children.indexOf(node)
  if (idx < 0) return false
  parent.children.splice(idx, 1)
  addTotals(parent, -node.size, -node.alloc, -node.fileCount, -(node.dirCount + 1))
  return true
}

export function removeFile(dir, file) {
  const idx = dir.files.indexOf(file)
  if (idx < 0) return false
  dir.files.splice(idx, 1)
  if (isCounted(file)) addTotals(dir, -file.size, -file.alloc, -1, 0)
  else addTotals(dir, 0, 0, -1, 0)
  return true
}

/** Replace the contents of `target` with the contents of `fresh` (same path). */
export function replaceContents(target, fresh) {
  addTotals(
    target,
    fresh.size - target.size,
    fresh.alloc - target.alloc,
    fresh.fileCount - target.fileCount,
    fresh.dirCount - target.dirCount
  )
  // addTotals already updated target itself; copy structure
  target.children = fresh.children
  for (const c of target.children) c.parent = target
  target.files = fresh.files
  target.mtime = fresh.mtime
  target.error = fresh.error
}

// ============================================
// Views sent to the renderer
// ============================================

const metricOfFile = (file, metric) => (isCounted(file) ? file[metric] : 0)

function fileView(dir, file) {
  return {
    type: 'file',
    name: file.name,
    path: filePath(dir, file),
    size: file.size,
    alloc: file.alloc,
    mtime: file.mtime,
    ext: extOf(file.name),
    hardlink: !isCounted(file),
    locked: (file.flags & FLAG_LOCKED) !== 0
  }
}

function dirHeader(node) {
  return {
    type: 'dir',
    name: node.name,
    path: node.path,
    size: node.size,
    alloc: node.alloc,
    files: node.fileCount,
    dirs: node.dirCount,
    mtime: node.mtime,
    error: node.error,
    childCount: node.children.length + node.files.length
  }
}

/**
 * Build a plain-object view of a directory.
 * depth: levels of children to include (1 = only direct children).
 * maxChildren: children kept per level; the rest are merged into one "other" entry.
 * includeFiles: whether files appear as children (dirs always do).
 */
export function buildView(node, opts = {}, extraChildren = null) {
  const { depth = 1, maxChildren = 200, metric = 'size', includeFiles = true } = opts
  const view = dirHeader(node)
  if (depth <= 0) return view

  const entries = []
  for (const child of node.children) entries.push({ v: child[metric], dir: child })
  if (includeFiles) {
    for (const file of node.files) entries.push({ v: metricOfFile(file, metric), file })
  }
  entries.sort((a, b) => b.v - a.v)

  const kept = entries.slice(0, maxChildren)
  const rest = entries.slice(maxChildren)

  view.children = kept.map((e) =>
    e.dir ? buildView(e.dir, { ...opts, depth: depth - 1 }) : fileView(node, e.file)
  )

  if (rest.length > 0) {
    const other = { type: 'other', name: '', path: node.path + '\u0000other', count: rest.length, size: 0, alloc: 0 }
    for (const e of rest) {
      if (e.dir) {
        other.size += e.dir.size
        other.alloc += e.dir.alloc
      } else if (isCounted(e.file)) {
        other.size += e.file.size
        other.alloc += e.file.alloc
      }
    }
    view.children.push(other)
  }

  if (extraChildren) {
    for (const extra of extraChildren) view.children.push(extra)
    view.children.sort((a, b) => b[metric] - a[metric])
  }
  return view
}

// ============================================
// Whole-tree traversal helpers
// ============================================

export function walkDirs(root, visit) {
  const stack = [root]
  while (stack.length) {
    const node = stack.pop()
    if (visit(node) === false) continue // skip subtree
    for (let i = node.children.length - 1; i >= 0; i--) stack.push(node.children[i])
  }
}

class TopN {
  constructor(n, key) {
    this.n = n
    this.key = key
    this.items = []
    this.min = -Infinity
  }

  push(item) {
    const k = this.key(item)
    if (this.items.length >= this.n && k <= this.min) return
    this.items.push(item)
    if (this.items.length > this.n * 2) this._trim()
  }

  _trim() {
    this.items.sort((a, b) => this.key(b) - this.key(a))
    this.items.length = Math.min(this.items.length, this.n)
    this.min = this.items.length >= this.n ? this.key(this.items[this.items.length - 1]) : -Infinity
  }

  result() {
    this._trim()
    return this.items
  }
}

export function summarize(root, { metric = 'size', limit = 200, oldAgeMs = 365 * 24 * 3600 * 1000 } = {}) {
  const now = Date.now()
  const largest = new TopN(limit, (x) => x.v)
  const old = new TopN(limit, (x) => x.v)
  const types = new Map()
  const errors = []
  let errorCount = 0

  walkDirs(root, (dir) => {
    if (dir.error) {
      errorCount++
      if (errors.length < 1000) errors.push({ path: dir.path, code: dir.error })
    }
    for (const file of dir.files) {
      const v = metricOfFile(file, metric)
      largest.push({ v, dir, file })
      if (file.mtime && now - file.mtime > oldAgeMs) old.push({ v, dir, file })
      const ext = extOf(file.name)
      let t = types.get(ext)
      if (!t) {
        t = { ext, count: 0, size: 0, alloc: 0 }
        types.set(ext, t)
      }
      t.count++
      if (isCounted(file)) {
        t.size += file.size
        t.alloc += file.alloc
      }
    }
  })

  const fileTypes = [...types.values()].sort((a, b) => b[metric] - a[metric])
  return {
    largestFiles: largest.result().map((x) => fileView(x.dir, x.file)),
    oldFiles: old.result().map((x) => fileView(x.dir, x.file)),
    fileTypes,
    errors,
    errorCount
  }
}

/**
 * Search the tree. query matches names (case-insensitive substring; `*` wildcards allowed).
 * exts: array of extensions like ['.mp4'] (files only). minSize in bytes for `metric`.
 * kind: 'all' | 'files' | 'dirs'. under: restrict to a subtree path.
 */
export function search(root, opts = {}) {
  const { query = '', exts = [], minSize = 0, kind = 'all', under = null, metric = 'size', limit = 500, olderThanMs = 0 } = opts
  let start = root
  if (under) {
    const found = lookup(root, under)
    if (!found || found.file) return { results: [], total: 0, truncated: false }
    start = found.dir
  }

  let matcher = null
  const q = String(query).trim().toLowerCase()
  if (q) {
    if (q.includes('*') || q.includes('?')) {
      const re = new RegExp(
        '^' + q.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
      )
      matcher = (name) => re.test(name.toLowerCase())
    } else {
      matcher = (name) => name.toLowerCase().includes(q)
    }
  }
  const extSet = new Set(exts.map((e) => (e.startsWith('.') ? e : '.' + e).toLowerCase()))
  const now = Date.now()
  const top = new TopN(limit, (x) => x.v)
  let total = 0

  walkDirs(start, (dir) => {
    if (dir !== start && kind !== 'files' && extSet.size === 0) {
      if ((!matcher || matcher(dir.name)) && dir[metric] >= minSize && (!olderThanMs || (dir.mtime && now - dir.mtime > olderThanMs))) {
        total++
        top.push({ v: dir[metric], dir })
      }
    }
    if (kind !== 'dirs') {
      for (const file of dir.files) {
        const v = metricOfFile(file, metric)
        if (v < minSize) continue
        if (matcher && !matcher(file.name)) continue
        if (extSet.size && !extSet.has(extOf(file.name))) continue
        if (olderThanMs && !(file.mtime && now - file.mtime > olderThanMs)) continue
        total++
        top.push({ v, dir, file })
      }
    }
  })

  const results = top.result().map((x) => (x.file ? fileView(x.dir, x.file) : dirHeader(x.dir)))
  return { results, total, truncated: total > results.length }
}
