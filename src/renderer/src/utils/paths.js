const SEP = window.api?.platform === 'win32' ? '\\' : '/'

export const pathSep = SEP

function trimSep(p) {
  return p.length > 1 && p.endsWith(SEP) && !/^[A-Za-z]:\\$/.test(p) ? p.slice(0, -1) : p
}

export function joinPath(dir, name) {
  return dir.endsWith(SEP) ? dir + name : dir + SEP + name
}

export function baseName(p) {
  const t = trimSep(p)
  const i = t.lastIndexOf(SEP)
  return i >= 0 ? t.slice(i + 1) || t : t
}

/** Parent of `p`, or null when `p` is the root (or outside it). */
export function parentPath(p, root) {
  const t = trimSep(p)
  const r = trimSep(root)
  if (t.toLowerCase() === r.toLowerCase()) return null
  const i = t.lastIndexOf(SEP)
  if (i < 0) return null
  const parent = t.slice(0, i) || SEP
  // "C:" -> "C:\"
  return /^[A-Za-z]:$/.test(parent) ? parent + SEP : parent
}

/** Breadcrumb segments from the root to `current`: [{ name, path }] */
export function crumbs(root, rootName, current) {
  const r = trimSep(root)
  const list = [{ name: rootName, path: root }]
  if (!current) return list
  const c = trimSep(current)
  if (c.toLowerCase() === r.toLowerCase()) return list
  const rel = c.slice(r.length).split(SEP).filter(Boolean)
  let acc = root
  for (const part of rel) {
    acc = joinPath(acc, part)
    list.push({ name: part, path: acc })
  }
  return list
}

export function isInside(p, root) {
  const a = trimSep(p).toLowerCase()
  const r = trimSep(root).toLowerCase()
  return a === r || a.startsWith(r.endsWith(SEP) ? r : r + SEP)
}
