import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import crypto from 'crypto'
import { promisify } from 'util'
import { DirNode, FileEntry } from './tree'

const gzip = promisify(zlib.gzip)
const gunzip = promisify(zlib.gunzip)
const CACHE_VERSION = 2

let cacheDir = null

export function initCache(userDataPath) {
  cacheDir = path.join(userDataPath, 'scan-cache')
  fs.mkdirSync(cacheDir, { recursive: true })
  // Remove v1 caches (partial trees keyed by drive letter)
  for (const f of fs.readdirSync(cacheDir)) {
    if (/^[A-Za-z]\.json$/.test(f)) fs.rmSync(path.join(cacheDir, f), { force: true })
  }
}

function cacheFile(rootPath) {
  // Windows paths are case-insensitive; Linux paths are not. Lowercasing on
  // Linux would make /home/Ana and /home/ana share one cache entry.
  const resolved = path.resolve(rootPath)
  const keyPath = process.platform === 'win32' ? resolved.toLowerCase() : resolved
  const key = crypto.createHash('sha1').update(keyPath).digest('hex')
  return path.join(cacheDir, `${key}.json.gz`)
}

// Compact encoding: dir = [name, mtime, error, [childDirs], [file fields...]]
// with 5 fields per file: name, size, alloc, mtime, flags.
function encode(node) {
  const files = new Array(node.files.length * 5)
  let i = 0
  for (const f of node.files) {
    files[i++] = f.name
    files[i++] = f.size
    files[i++] = f.alloc
    files[i++] = Math.round(f.mtime)
    files[i++] = f.flags
  }
  return [node.name, Math.round(node.mtime), node.error, node.children.map(encode), files]
}

function decode(data, parent, fullPath) {
  const [name, mtime, error, children, files] = data
  const node = new DirNode(name, parent, fullPath)
  node.mtime = mtime
  node.error = error
  for (let i = 0; i < files.length; i += 5) {
    const f = new FileEntry(files[i], files[i + 1], files[i + 2], files[i + 3], files[i + 4])
    node.files.push(f)
    node.fileCount++
    if (!(f.flags & 1)) {
      node.size += f.size
      node.alloc += f.alloc
    }
  }
  for (const c of children) {
    const child = decode(c, node, path.join(fullPath, c[0]))
    node.children.push(child)
    node.size += child.size
    node.alloc += child.alloc
    node.fileCount += child.fileCount
    node.dirCount += child.dirCount + 1
  }
  return node
}

export async function saveCache(root, meta) {
  if (!cacheDir) return false
  const payload = { version: CACHE_VERSION, meta, tree: encode(root) }
  const buf = await gzip(Buffer.from(JSON.stringify(payload), 'utf8'), { level: 6 })
  const file = cacheFile(root.path)
  await fs.promises.writeFile(file + '.tmp', buf)
  await fs.promises.rename(file + '.tmp', file)
  return true
}

export async function loadCache(rootPath) {
  if (!cacheDir) return null
  const file = cacheFile(rootPath)
  try {
    const buf = await gunzip(await fs.promises.readFile(file))
    const payload = JSON.parse(buf.toString('utf8'))
    if (payload.version !== CACHE_VERSION || !payload.meta?.complete) return null
    const root = decode(payload.tree, null, payload.meta.rootPath)
    return { root, meta: payload.meta }
  } catch {
    return null
  }
}

export async function hasCache(rootPath) {
  if (!cacheDir) return null
  try {
    const st = await fs.promises.stat(cacheFile(rootPath))
    return st.mtimeMs
  } catch {
    return null
  }
}

export async function deleteCache(rootPath) {
  if (!cacheDir) return
  await fs.promises.rm(cacheFile(rootPath), { force: true })
}
