import fs from 'fs'
import crypto from 'crypto'
import { walkDirs, isCounted, filePath } from './tree'

const EDGE = 64 * 1024 // bytes read from the start and the end in the quick pass
const CONCURRENCY = 4
const MAX_GROUPS = 300

async function quickHash(file) {
  const fd = await fs.promises.open(file.path, 'r')
  try {
    const hash = crypto.createHash('sha1')
    const head = Buffer.alloc(Math.min(EDGE, file.size))
    await fd.read(head, 0, head.length, 0)
    hash.update(head)
    if (file.size > EDGE * 2) {
      const tail = Buffer.alloc(EDGE)
      await fd.read(tail, 0, EDGE, file.size - EDGE)
      hash.update(tail)
    } else if (file.size > EDGE) {
      const tail = Buffer.alloc(file.size - EDGE)
      await fd.read(tail, 0, tail.length, EDGE)
      hash.update(tail)
    }
    return hash.digest('hex')
  } finally {
    await fd.close()
  }
}

function fullHash(file, ctl, onBytes) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1')
    const stream = fs.createReadStream(file.path, { highWaterMark: 1024 * 1024 })
    stream.on('data', (chunk) => {
      if (ctl.cancelled) {
        stream.destroy()
        reject(new Error('cancelled'))
        return
      }
      hash.update(chunk)
      onBytes(chunk.length)
    })
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

async function mapLimit(items, limit, fn) {
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      await fn(items[i], i)
    }
  })
  await Promise.all(workers)
}

async function splitBy(group, hasher) {
  const buckets = new Map()
  await mapLimit(group, CONCURRENCY, async (file) => {
    try {
      const h = await hasher(file)
      if (!buckets.has(h)) buckets.set(h, [])
      buckets.get(h).push(file)
    } catch {
      // unreadable or vanished: not a candidate
    }
  })
  return [...buckets.entries()].filter(([, files]) => files.length >= 2)
}

/**
 * Find byte-identical files. Candidates are grouped by size, then by a hash of
 * their first and last 64 KB, and finally confirmed with a full SHA-1.
 */
export async function findDuplicates(root, { minSize = 1024 * 1024, ctl = {}, onProgress = () => {} } = {}) {
  const bySize = new Map()
  walkDirs(root, (dir) => {
    for (const f of dir.files) {
      if (f.size < minSize || !isCounted(f)) continue
      let list = bySize.get(f.size)
      if (!list) bySize.set(f.size, (list = []))
      list.push({ path: filePath(dir, f), name: f.name, size: f.size, mtime: f.mtime })
    }
  })

  const sizeGroups = [...bySize.values()].filter((g) => g.length >= 2)
  const quickTotal = sizeGroups.reduce((n, g) => n + g.length, 0)
  let quickDone = 0
  onProgress({ phase: 'quick', done: 0, total: quickTotal })

  const confirmCandidates = []
  for (const group of sizeGroups) {
    if (ctl.cancelled) return null
    const buckets = await splitBy(group, async (f) => {
      const h = await quickHash(f)
      return h
    })
    quickDone += group.length
    onProgress({ phase: 'quick', done: quickDone, total: quickTotal })
    for (const [, files] of buckets) confirmCandidates.push(files)
  }

  // Biggest potential savings first
  confirmCandidates.sort((a, b) => b[0].size * (b.length - 1) - a[0].size * (a.length - 1))
  const fullTotal = confirmCandidates.reduce(
    (n, g) => n + (g[0].size > EDGE * 2 ? g[0].size * g.length : 0),
    0
  )
  let fullDone = 0
  let lastReport = 0
  const report = () => {
    const now = Date.now()
    if (now - lastReport > 200) {
      lastReport = now
      onProgress({ phase: 'full', done: fullDone, total: fullTotal })
    }
  }

  const groups = []
  for (const candidates of confirmCandidates) {
    if (ctl.cancelled) return null
    let confirmed
    if (candidates[0].size <= EDGE * 2) {
      confirmed = [['', candidates]] // quick hash already covered the whole file
    } else {
      try {
        confirmed = await splitBy(candidates, (f) =>
          fullHash(f, ctl, (n) => {
            fullDone += n
            report()
          })
        )
      } catch {
        if (ctl.cancelled) return null
        continue
      }
    }
    for (const [, files] of confirmed) {
      groups.push({
        size: files[0].size,
        count: files.length,
        wasted: files[0].size * (files.length - 1),
        files: files.sort((a, b) => a.mtime - b.mtime)
      })
    }
  }

  onProgress({ phase: 'done', done: fullTotal, total: fullTotal })
  groups.sort((a, b) => b.wasted - a.wasted)
  return {
    groups: groups.slice(0, MAX_GROUPS),
    totalGroups: groups.length,
    totalWasted: groups.reduce((n, g) => n + g.wasted, 0)
  }
}
