// Generates the mobile app icons into mobile/assets/images (same mark as the web icons).
//   node scripts/generate-mobile-icons.mjs
// Design: lime barbell on near-black. "maskable" and Apple icons are full-bleed squares
// (the OS applies its own mask); the regular ones have rounded corners.

import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BG = [8, 8, 8]
const LIME = [200, 245, 58]
const BAR = [240, 236, 228]

const ICONS = [
  { file: 'icon.png', size: 1024, rounded: false, scale: 0.6 },
  // Android adaptive icon: the OS masks it, so keep the mark inside the inner ~60%.
  { file: 'android-icon-foreground.png', size: 1024, rounded: false, scale: 0.42, transparent: true },
  { file: 'android-icon-background.png', size: 1024, rounded: false, scale: 0, solid: true },
  { file: 'android-icon-monochrome.png', size: 1024, rounded: false, scale: 0.42, transparent: true, mono: true },
  { file: 'splash-icon.png', size: 512, rounded: false, scale: 0.8, transparent: true },
]

// Barbell in unit coordinates (0..1 inside the mark box): [x, y, w, h, color]
const SHAPES = [
  [0.00, 0.28, 0.16, 0.44, LIME],
  [0.18, 0.18, 0.12, 0.64, LIME],
  [0.30, 0.46, 0.40, 0.08, BAR],
  [0.70, 0.18, 0.12, 0.64, LIME],
  [0.84, 0.28, 0.16, 0.44, LIME],
]

const inRoundRect = (x, y, x0, y0, w, h, r) => {
  if (x < x0 || y < y0 || x > x0 + w || y > y0 + h) return false
  const cx = Math.min(Math.max(x, x0 + r), x0 + w - r)
  const cy = Math.min(Math.max(y, y0 + r), y0 + h - r)
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}

function render({ size, rounded, scale, transparent = false, solid = false, mono = false }) {
  const px = Buffer.alloc(size * size * 4)
  const mark = size * scale
  const off = (size - mark) / 2
  const corner = rounded ? size * 0.22 : 0
  const SS = 4 // 4×4 supersampling for smooth edges

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = x + (sx + 0.5) / SS
          const fy = y + (sy + 0.5) / SS
          if (corner && !inRoundRect(fx, fy, 0, 0, size, size, corner)) continue
          let c = transparent ? null : BG
          if (!solid) for (const [ux, uy, uw, uh, color] of SHAPES) {
            if (inRoundRect(fx, fy, off + ux * mark, off + uy * mark, uw * mark, uh * mark, mark * 0.04)) c = mono ? [255, 255, 255] : color
          }
          if (!c) continue
          r += c[0]; g += c[1]; b += c[2]; a += 255
        }
      }
      const n = SS * SS
      const i = (y * size + x) * 4
      const cov = a / n
      // Un-premultiply so partially covered corner pixels keep the right colour.
      px[i] = cov ? Math.round((r / n) * 255 / cov) : 0
      px[i + 1] = cov ? Math.round((g / n) * 255 / cov) : 0
      px[i + 2] = cov ? Math.round((b / n) * 255 / cov) : 0
      px[i + 3] = Math.round(cov)
    }
  }
  return encodePng(size, size, px)
}

// ─── Minimal PNG encoder (RGBA, 8-bit, no filtering) ───────────────────────

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = buf => {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 6 // 8-bit RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('mobile/assets/images', { recursive: true })
for (const icon of ICONS) {
  writeFileSync(`mobile/assets/images/${icon.file}`, render(icon))
  console.log(`✓ mobile/assets/images/${icon.file}`)
}
