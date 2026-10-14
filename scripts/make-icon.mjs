// Generates resources/icon.png (256x256 RGBA) for Check Space.
// Dependency-free: draws a rounded square in the accent colour with a stylised
// donut chart (a 30% slice pulled out) using supersampled anti-aliasing,
// then encodes the PNG with zlib + manual chunk/CRC writing.
//
// Run from the repo root:   node scripts/make-icon.mjs
// (package.json is intentionally not modified; add a script entry if you want
//  e.g. "icon": "node scripts/make-icon.mjs")

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 256
const SS = 4 // supersampling per axis (16 samples per pixel)
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'resources', 'icon.png')

const BG = [0xc9, 0x64, 0x42] // #C96442
const WHITE = [255, 255, 255]

const CENTER = SIZE / 2
const CORNER_RADIUS = 56
const RING_INNER = 36
const RING_OUTER = 86
const SLICE_SHARE = 0.3
const SLICE_START = 0 // radians from 12 o'clock, clockwise
const SLICE_SPAN = SLICE_SHARE * Math.PI * 2
const EXPLODE = 12 // px the slice is pulled outwards
const SLICE_ALPHA = 0.55

const sliceMid = SLICE_START + SLICE_SPAN / 2
const sliceDx = Math.sin(sliceMid) * EXPLODE
const sliceDy = -Math.cos(sliceMid) * EXPLODE

/** Signed distance to a rounded square covering the whole canvas (<= 0 inside). */
function roundedSquareDistance(x, y) {
  const half = SIZE / 2 - CORNER_RADIUS
  const qx = Math.abs(x - CENTER) - half
  const qy = Math.abs(y - CENTER) - half
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
  const inside = Math.min(Math.max(qx, qy), 0)
  return outside + inside - CORNER_RADIUS
}

/** Angle from 12 o'clock, clockwise, in [0, 2π). */
function angleFromTop(dx, dy) {
  let a = Math.atan2(dx, -dy)
  if (a < 0) a += Math.PI * 2
  return a
}

/** Composite a colour with alpha over an existing RGBA (non-premultiplied) pixel. */
function over(dst, src, alpha) {
  const a = alpha + dst[3] * (1 - alpha)
  if (a <= 0) return [0, 0, 0, 0]
  return [
    (src[0] * alpha + dst[0] * dst[3] * (1 - alpha)) / a,
    (src[1] * alpha + dst[1] * dst[3] * (1 - alpha)) / a,
    (src[2] * alpha + dst[2] * dst[3] * (1 - alpha)) / a,
    a
  ]
}

/** Colour of a single sample point (x, y in canvas pixels). */
function shade(x, y) {
  let px = [0, 0, 0, 0]
  if (roundedSquareDistance(x, y) > 0) return px
  px = [BG[0], BG[1], BG[2], 1]

  // Whole donut, minus the exploded slice
  const dx = x - CENTER
  const dy = y - CENTER
  const r = Math.hypot(dx, dy)
  if (r >= RING_INNER && r <= RING_OUTER) {
    const a = angleFromTop(dx, dy)
    if (a < SLICE_START || a >= SLICE_START + SLICE_SPAN) {
      px = over(px, WHITE, 1)
    }
  }

  // The exploded slice, drawn semi-transparent
  const sx = x - CENTER - sliceDx
  const sy = y - CENTER - sliceDy
  const sr = Math.hypot(sx, sy)
  if (sr >= RING_INNER && sr <= RING_OUTER) {
    const a = angleFromTop(sx, sy)
    if (a >= SLICE_START && a < SLICE_START + SLICE_SPAN) {
      px = over(px, WHITE, SLICE_ALPHA)
    }
  }
  return px
}

function renderPixels() {
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE) // one filter byte per row
  const samples = SS * SS
  for (let py = 0; py < SIZE; py++) {
    const rowStart = py * (SIZE * 4 + 1)
    raw[rowStart] = 0 // filter: none
    for (let px = 0; px < SIZE; px++) {
      let pr = 0
      let pg = 0
      let pb = 0
      let pa = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) / SS
          const y = py + (sy + 0.5) / SS
          const [r, g, b, a] = shade(x, y)
          // accumulate premultiplied colour so edges blend correctly
          pr += r * a
          pg += g * a
          pb += b * a
          pa += a
        }
      }
      const o = rowStart + 1 + px * 4
      const alpha = pa / samples
      if (alpha > 0) {
        raw[o] = Math.round(pr / pa)
        raw[o + 1] = Math.round(pg / pa)
        raw[o + 2] = Math.round(pb / pa)
      }
      raw[o + 3] = Math.round(alpha * 255)
    }
  }
  return raw
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

function encodePng(raw) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(SIZE, 0)
  ihdr.writeUInt32BE(SIZE, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter method
  ihdr[12] = 0 // interlace
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, encodePng(renderPixels()))
console.log(`Wrote ${OUT}`)
