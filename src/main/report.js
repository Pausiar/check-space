import fs from 'fs'
import { walkDirs, filePath, isCounted, buildView, summarize } from './tree'

const csvField = (v) => {
  const s = String(v ?? '')
  return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

const iso = (ms) => (ms ? new Date(ms).toISOString() : '')

/** CSV with every folder plus every file of at least `minFileSize` bytes. */
export async function writeCsv(root, target, { minFileSize = 10 * 1024 * 1024 } = {}) {
  const stream = fs.createWriteStream(target, { encoding: 'utf8' })
  const write = (line) =>
    new Promise((resolve) => {
      if (stream.write(line)) resolve()
      else stream.once('drain', resolve)
    })

  // BOM + sep hint so Excel opens it correctly in any locale
  await write('﻿sep=,\r\n')
  await write('type,path,size_bytes,size_on_disk_bytes,files,folders,modified\r\n')

  const rows = []
  walkDirs(root, (dir) => {
    rows.push(['folder', dir.path, dir.size, dir.alloc, dir.fileCount, dir.dirCount, iso(dir.mtime)])
    for (const f of dir.files) {
      if (f.size >= minFileSize && isCounted(f)) {
        rows.push(['file', filePath(dir, f), f.size, f.alloc, '', '', iso(f.mtime)])
      }
    }
    if (rows.length > 5000) {
      const chunk = rows.splice(0).map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n'
      // writing synchronously-ordered chunks; backpressure handled below
      stream.write(chunk)
    }
  })
  if (rows.length) await write(rows.map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n')
  await new Promise((resolve, reject) => {
    stream.end(resolve)
    stream.on('error', reject)
  })
}

export async function writeJson(root, target, meta) {
  const summary = summarize(root, { limit: 200 })
  const report = {
    generatedAt: new Date().toISOString(),
    root: meta.rootPath,
    scannedAt: meta.savedAt ? new Date(meta.savedAt).toISOString() : null,
    complete: meta.complete,
    totals: { size: root.size, sizeOnDisk: root.alloc, files: root.fileCount, folders: root.dirCount },
    drive: meta.drive || null,
    tree: buildView(root, { depth: 3, maxChildren: 50, includeFiles: false }),
    largestFiles: summary.largestFiles,
    fileTypes: summary.fileTypes.slice(0, 100),
    inaccessibleFolders: summary.errors
  }
  await fs.promises.writeFile(target, JSON.stringify(report, null, 2), 'utf8')
}
