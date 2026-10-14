import { hierarchy } from 'd3-hierarchy'
import { COLORS, NEUTRAL, SYSTEM_COLOR, colorForExt } from '../../utils/colors'

// ============================================
// Data preparation shared by the treemap and the sunburst
// ============================================

/** Value of a view entry for the charts (hardlinks count 0). */
export function entryValue(entry, metric) {
  if (!entry) return 0
  if (entry.type === 'file' && entry.hardlink) return 0
  return Math.max(0, entry[metric] || 0)
}

/** True for entries that map to a real path on disk (usable with file actions). */
export function isReal(entry) {
  return !!entry && (entry.type === 'file' || entry.type === 'dir') && !entry.path.includes('\u0000')
}

/**
 * Convert a view into a d3 hierarchy. Directories whose children don't add up to
 * their own size (e.g. the live view, which has no files) get a "filler" leaf with
 * the remainder so areas stay proportional.
 */
// Leaves smaller than total/N are merged (keeps layout and rendering cheap)
const MIN_FRACTION_DIVISOR = 8000

export function buildHierarchy(view, metric, maxDepth = Infinity) {
  if (!view) return null
  const minValue = entryValue(view, metric) / MIN_FRACTION_DIVISOR
  const prep = (entry, depth) => {
    const v = entryValue(entry, metric)
    if (entry.type !== 'dir' || !entry.children || entry.children.length === 0 || depth >= maxDepth) {
      return { entry, v }
    }
    const children = []
    let sum = 0
    let other = null
    for (const c of entry.children) {
      // Entries too small to ever be visible are merged into this folder's "other" entry
      const cv = entryValue(c, metric)
      if ((cv < minValue && depth > 0) || c.type === 'other') {
        if (cv <= 0) continue
        if (!other) {
          other = { entry: { type: 'other', path: entry.path + '\u0000other', count: 0, size: 0, alloc: 0 }, v: 0 }
        }
        other.entry.count += c.type === 'other' ? c.count : 1
        other.entry.size += c.size || 0
        other.entry.alloc += c.alloc || 0
        other.v += cv
        continue
      }
      const n = prep(c, depth + 1)
      if (n.v > 0 || n.children) {
        children.push(n)
        sum += n.v
      }
    }
    if (other) {
      children.push(other)
      sum += other.v
    }
    const rest = v - sum
    if (rest > v * 0.001 && rest > 0) {
      children.push({
        entry: { type: 'filler', path: entry.path + '\u0000filler', size: rest, alloc: rest },
        v: rest
      })
      sum += rest
    }
    if (children.length === 0) return { entry, v }
    return { entry, v: sum, children }
  }
  const root = hierarchy(prep(view, 0), (d) => d.children)
    .sum((d) => (d.children ? 0 : d.v))
    .sort((a, b) => b.value - a.value)
  if (!root.value) return null

  // Assign the top-level branch index used for colouring
  root.branch = -1
  ;(root.children || []).forEach((c, i) => {
    c.each((n) => {
      n.branch = i
    })
  })
  return root
}

// ============================================
// Colours
// ============================================

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function mix(hex, target, t) {
  const a = hexToRgb(hex)
  const b = hexToRgb(target)
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t))
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** True when white text reads better than dark text on `hex`. */
export function prefersLightText(hex) {
  return luminance(hex) < 0.36
}

/** Fill colour for a hierarchy node. */
export function colorForNode(node, isDark) {
  const e = node.data.entry
  if (e.type === 'file') return colorForExt(e.ext)
  if (e.type === 'other' || e.type === 'filler') return isDark ? mix(NEUTRAL, '#1E1E1E', 0.35) : NEUTRAL
  if (e.type === 'system') return SYSTEM_COLOR
  const base = COLORS[(node.branch >= 0 ? node.branch : 0) % COLORS.length]
  const level = Math.max(0, node.depth - 1)
  if (level === 0) return base
  return isDark ? mix(base, '#141414', Math.min(0.6, level * 0.2)) : mix(base, '#FFFFFF', Math.min(0.6, level * 0.22))
}

// ============================================
// Text helpers
// ============================================

const CHAR_W = 6.4 // approx width of a character at 11px

/** Truncate `text` to fit `width` px (approximate), or '' when nothing fits. */
export function fitText(text, width, charW = CHAR_W) {
  if (!text) return ''
  const max = Math.floor(width / charW)
  if (max < 3) return ''
  if (text.length <= max) return text
  return text.slice(0, max - 1) + '…'
}

export function textWidth(text, charW = CHAR_W) {
  return (text ? text.length : 0) * charW
}

/** Display name for an entry (handles synthetic entries). */
export function entryLabel(entry, t) {
  if (entry.type === 'other') return t('common.otherItems', { count: entry.count })
  if (entry.type === 'system') return t('common.systemSpace')
  if (entry.type === 'filler') return t('map.looseFiles')
  return entry.name || entry.path
}
