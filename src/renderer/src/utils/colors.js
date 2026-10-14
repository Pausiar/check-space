// Categorical palette used across charts (works on light and dark backgrounds)
export const COLORS = [
  '#6366F1', // indigo
  '#8B5CF6', // violet
  '#06B6D4', // cyan
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#EC4899', // pink
  '#14B8A6' // teal
]

export const NEUTRAL = '#94A3B8' // "other" / loose files
export const SYSTEM_COLOR = '#64748B' // system / unaccounted space

// File categories by extension, used to colour files consistently
export const CATEGORIES = {
  video: { color: '#EF4444', exts: ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg', '.ts', '.vob', '.3gp'] },
  image: { color: '#EC4899', exts: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tif', '.tiff', '.webp', '.heic', '.raw', '.cr2', '.nef', '.arw', '.dng', '.psd', '.svg', '.ico'] },
  audio: { color: '#F59E0B', exts: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma', '.opus', '.aiff'] },
  document: { color: '#10B981', exts: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp', '.txt', '.rtf', '.csv', '.md', '.epub'] },
  archive: { color: '#8B5CF6', exts: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.iso', '.img', '.cab', '.zst'] },
  executable: { color: '#06B6D4', exts: ['.exe', '.msi', '.dll', '.sys', '.appx', '.msix', '.bat', '.cmd', '.ps1', '.so', '.dylib'] },
  code: { color: '#14B8A6', exts: ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.cs', '.go', '.rs', '.rb', '.php', '.html', '.css', '.json', '.xml', '.yml', '.yaml', '.map'] },
  data: { color: '#6366F1', exts: ['.vhd', '.vhdx', '.vmdk', '.vdi', '.qcow2', '.pak', '.bin', '.dat', '.db', '.sqlite', '.log', '.tmp', '.cache'] }
}

const extToCategory = new Map()
for (const [name, c] of Object.entries(CATEGORIES)) for (const e of c.exts) extToCategory.set(e, name)

/** Category key for an extension (with dot, lowercase) or 'other'. */
export function categoryOf(ext) {
  return extToCategory.get(ext) || 'other'
}

export function colorForExt(ext) {
  const cat = extToCategory.get(ext)
  return cat ? CATEGORIES[cat].color : NEUTRAL
}
