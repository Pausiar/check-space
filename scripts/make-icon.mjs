// Generates the Check Space app icon.
//
//   resources/icon.png   1024x1024 RGBA (window icon, Linux/macOS source)
//   resources/icon.ico   16, 20, 24, 32, 40, 48, 64, 128, 256 px for Windows
//
// Dependency-free: the mark is drawn with a signed distance field and 4x4
// supersampling per pixel, then encoded as PNG (zlib) or as a Windows ICO
// (BMP entries for small sizes, PNG entries for 128/256 as Windows expects).
//
// Run from the repo root:   node scripts/make-icon.mjs

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RES = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'resources')

// The ICO sizes Windows actually asks for. 256 is the maximum allowed.
const ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]
const PNG_SIZE = 1024
const SS = 4 // supersampling per axis (16 samples per pixel)

// --- Geometry, expressed as a fraction of the canvas so every size matches ---
const CORNER = 0.21875 // corner radius
const RING_INNER = 0.1406
const RING_OUTER = 0.336
const SLICE_SHARE = 0.3 // the highlighted 30% wedge
const EXPLODE = 0.058 // how far the wedge is pulled outwards
const GAP = 0.06 // radians of empty space around the wedge
const SLICE_ALPHA = 0.55

// Brand colours: the app accent (#C96442) with a little depth.
const BG_TOP = [0xd8, 0x76, 0x51]
const BG_BOTTOM = [0xa8, 0x4b, 0x2c]
const WHITE = [255, 255, 255]

const TWO_PI = Math.PI * 2
const SLICE_START = 0 // 12 o'clock, clockwise
const SLICE_SPAN = SLICE_SHARE * TWO_PI

/** Signed distance to the rounded square covering the canvas (<= 0 inside). */
function roundedSquareDistance(x, y, size) {
  const half = size / 2 - CORNER * size
  const qx = Math.abs(x - size / 2) - half
  const qy = Math.abs(y - size / 2) - half
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
  const inside = Math.min(Math.max(qx, qy), 0)
  return outside + inside - CORNER * size
}

/** Angle from 12 o'clock, clockwise, in [0, 2π). */
function angleFromTop(dx, dy) {
  let a = Math.atan2(dx, -dy)
  if (a < 0) a += TWO_PI
  return a
}

function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

/**
 * Colour of one sample point. Writes the premultiplied result into `out` so the
 * hot loop allocates nothing:
 *   out[0..2] = colour * alpha, out[3] = alpha
 */
function shade(x, y, size, out) {
  if (roundedSquareDistance(x, y, size) > 0) {
    out[0] = out[1] = out[2] = out[3] = 0
    return
  }

  const c = size / 2
  const dx = x - c
  const dy = y - c
  const dist = Math.hypot(dx, dy)

  // Diagonal gradient plus a soft highlight towards the top-left, which keeps
  // the mark from looking flat at large sizes without hurting 16 px legibility.
  let t = (x + y) / (2 * size)
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const light = 1 + 0.07 * Math.max(0, 1 - dist / (size * 0.62))
  let r = clamp255((BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t) * light)
  let g = clamp255((BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t) * light)
  let b = clamp255((BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t) * light)
  let a = 1

  // Small sizes get slightly thinner strokes and a wider hole so the mark
  // stays legible in the taskbar instead of turning into a white blob.
  const small = size <= 32
  const inner = RING_INNER * size * (small ? 1.14 : 1)
  const outer = RING_OUTER * size * (small ? 0.97 : 1)
  const mid = SLICE_START + SLICE_SPAN / 2
  const sx = x - c - Math.sin(mid) * EXPLODE * size
  const sy = y - c + Math.cos(mid) * EXPLODE * size
  const sr = Math.hypot(sx, sy)
  const sa = angleFromTop(sx, sy)
  // Footprint of the exploded wedge: the ring is cut away here so the wedge
  // reads as a separate slice instead of blending into the donut.
  const inWedge = sr >= inner && sr <= outer && sa <= SLICE_SPAN

  // The main donut, with a gap on each side of the wedge.
  const rimInside = dist >= inner && dist <= outer
  if (rimInside && !inWedge) {
    const rimAngle = angleFromTop(dx, dy)
    if (rimAngle >= SLICE_SPAN + GAP || rimAngle <= TWO_PI - GAP) {
      r = WHITE[0]
      g = WHITE[1]
      b = WHITE[2]
    }
  }

  // The exploded wedge itself, slightly lighter than the ring.
  if (inWedge && sa >= GAP * 0.5 && sa <= SLICE_SPAN - GAP * 0.5) {
    r = r * (1 - SLICE_ALPHA) + WHITE[0] * SLICE_ALPHA
    g = g * (1 - SLICE_ALPHA) + WHITE[1] * SLICE_ALPHA
    b = b * (1 - SLICE_ALPHA) + WHITE[2] * SLICE_ALPHA
  }

  out[0] = r * a
  out[1] = g * a
  out[2] = b * a
  out[3] = a
}

/** Rasterises the icon at `size` and returns straight (non-premultiplied) RGBA. */
function render(size) {
  const rgba = Buffer.alloc(size * size * 4)
  const samples = SS * SS
  const out = [0, 0, 0, 0]
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let pr = 0
      let pg = 0
      let pb = 0
      let pa = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          shade(px + (sx + 0.5) / SS, py + (sy + 0.5) / SS, size, out)
          pr += out[0]
          pg += out[1]
          pb += out[2]
          pa += out[3]
        }
      }
      const o = (py * size + px) * 4
      const alpha = pa / samples
      if (alpha > 0) {
        rgba[o] = Math.round(pr / pa)
        rgba[o + 1] = Math.round(pg / pa)
        rgba[o + 2] = Math.round(pb / pa)
      }
      rgba[o + 3] = Math.round(alpha * 255)
    }
  }
  return rgba
}

// ---- PNG encoding ----

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData), 0)
  return Buffer.concat([len, typeAndData, crc])
}

function encodePng(rgba, size) {
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// ---- ICO encoding ----
// Small sizes use a 32-bit BMP entry because every Windows version (and
// rcedit, which electron-builder uses to stamp the exe) reads those; 128 and
// 256 use PNG entries, which is what Windows itself writes.

function encodeDib(rgba, size) {
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0) // biSize
  header.writeInt32LE(size, 4) // biWidth
  header.writeInt32LE(size * 2, 8) // biHeight: colour + AND mask
  header.writeUInt16LE(1, 12) // biPlanes
  header.writeUInt16LE(32, 14) // biBitCount
  header.writeUInt32LE(0, 16) // BI_RGB
  header.writeUInt32LE(size * size * 4, 20) // biSizeImage

  const pixels = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    const srcRow = (size - 1 - y) * size * 4 // bottom-up
    for (let x = 0; x < size; x++) {
      const s = srcRow + x * 4
      const d = (y * size + x) * 4
      pixels[d] = rgba[s + 2] // B
      pixels[d + 1] = rgba[s + 1] // G
      pixels[d + 2] = rgba[s] // R
      pixels[d + 3] = rgba[s + 3] // A
    }
  }

  // 1-bit AND mask: transparent pixels set, rows padded to 4 bytes.
  const maskStride = Math.ceil(size / 32) * 4
  const mask = Buffer.alloc(maskStride * size)
  for (let y = 0; y < size; y++) {
    const srcRow = (size - 1 - y) * size * 4
    for (let x = 0; x < size; x++) {
      if (rgba[srcRow + x * 4 + 3] === 0) {
        mask[y * maskStride + (x >> 3)] |= 0x80 >> (x & 7)
      }
    }
  }

  return Buffer.concat([header, pixels, mask])
}

function encodeIco(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(entries.length, 4)

  const dir = Buffer.alloc(16 * entries.length)
  let offset = header.length + dir.length
  entries.forEach((entry, i) => {
    const o = i * 16
    dir[o] = entry.size >= 256 ? 0 : entry.size // 0 means 256
    dir[o + 1] = entry.size >= 256 ? 0 : entry.size
    dir[o + 2] = 0 // palette colours
    dir[o + 3] = 0 // reserved
    dir.writeUInt16LE(1, o + 4) // planes
    dir.writeUInt16LE(32, o + 6) // bits per pixel
    dir.writeUInt32LE(entry.data.length, o + 8)
    dir.writeUInt32LE(offset, o + 12)
    offset += entry.data.length
  })

  return Buffer.concat([header, dir, ...entries.map((e) => e.data)])
}

// ---- Main ----

mkdirSync(RES, { recursive: true })

const pngPath = resolve(RES, 'icon.png')
const large = render(PNG_SIZE)
writeFileSync(pngPath, encodePng(large, PNG_SIZE))

const entries = ICO_SIZES.map((size) => {
  const rgba = size === PNG_SIZE ? large : render(size)
  return {
    size,
    data: size >= 128 ? encodePng(rgba, size) : encodeDib(rgba, size)
  }
})
const icoPath = resolve(RES, 'icon.ico')
writeFileSync(icoPath, encodeIco(entries))

console.log(`Wrote ${pngPath} (${PNG_SIZE}x${PNG_SIZE})`)
console.log(`Wrote ${icoPath} (${ICO_SIZES.join(', ')} px)`)
