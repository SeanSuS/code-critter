// Generates characters/monkey/character.json: the built-in monkey, drawn from
// shapes so every frame keeps the same anchor. Run: node tools/build-monkey.mjs
import { writeFileSync } from 'node:fs'

const N = 32
const PALETTE = {
  o: '#3b2314', b: '#b5723a', d: '#8f5526', f: '#f3dcb4', e: '#2b1b12', w: '#ffffff',
  p: '#e58c8c', h: '#3a3f58', c: '#4fb3bf', g: '#9aa3ad', y: '#f2c94c', k: '#1b1b1b',
  r: '#d9534f', s: '#f8f8f2', m: '#5b8def',
}

const blank = () => Array.from({ length: N }, () => Array(N).fill('.'))
const set = (g, x, y, c) => {
  x = Math.round(x); y = Math.round(y)
  if (x >= 0 && x < N && y >= 0 && y < N) g[y][x] = c
}
const ell = (g, cx, cy, rx, ry, c, keep = () => true) => {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 && keep(x, y)) g[y][x] = c
}
const rect = (g, x, y, w, h, c) => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(g, x + i, y + j, c)
}
const line = (g, x0, y0, x1, y1, c, t = 1) => {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let i = 0; i <= steps; i++) rect(g, Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), t, t, c)
}
const outline = g => {
  const out = g.map(row => [...row])
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (g[y][x] !== '.') continue
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (g[y + dy]?.[x + dx] ?? '.') !== '.')
    if (near) out[y][x] = 'o'
  }
  return out
}
const squash = (g, sx, sy) => {
  const out = blank()
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const srcX = Math.round(16 + (x - 16) / sx), srcY = Math.round(30 - (30 - y) / sy)
    out[y][x] = g[srcY]?.[srcX] ?? '.'
  }
  return out
}

const EYES = {
  open: (g, x, y) => { rect(g, x, y, 2, 2, 'e'); set(g, x, y, 'w') },
  blink: (g, x, y) => rect(g, x, y + 1, 2, 1, 'e'),
  half: (g, x, y) => { rect(g, x, y + 1, 2, 1, 'e'); rect(g, x, y, 2, 1, 'd') },
  up: (g, x, y) => { rect(g, x, y - 1, 2, 2, 'e'); set(g, x + 1, y - 1, 'w') },
  down: (g, x, y) => { rect(g, x, y + 1, 2, 2, 'e'); set(g, x, y + 1, 'w') },
  happy: (g, x, y) => { set(g, x - 1, y + 1, 'e'); set(g, x, y, 'e'); set(g, x + 1, y, 'e'); set(g, x + 2, y + 1, 'e') },
  wide: (g, x, y) => { rect(g, x - 1, y - 1, 3, 3, 'w'); rect(g, x, y, 2, 2, 'e') },
}
const MOUTHS = {
  smile: (g, y) => { set(g, 14, y, 'e'); set(g, 15, y + 1, 'e'); set(g, 16, y + 1, 'e'); set(g, 17, y, 'e') },
  open: (g, y) => { rect(g, 15, y, 2, 2, 'r'); rect(g, 14, y, 1, 1, 'e'); rect(g, 17, y, 1, 1, 'e') },
  frown: (g, y) => { set(g, 14, y + 1, 'e'); set(g, 15, y, 'e'); set(g, 16, y, 'e'); set(g, 17, y + 1, 'e') },
  flat: (g, y) => rect(g, 15, y + 1, 2, 1, 'e'),
  o: (g, y) => rect(g, 15, y, 2, 2, 'e'),
}

// One pose, before the outline. Hands are given as [x, y] targets.
const paint = (p = {}) => {
  const { dy = 0, head = 0, eyes = 'open', mouth = 'smile', left = [9, 26], right = [23, 26], cheeks = false, tail = 0, extra, cx = 0 } = p
  const g = blank()
  const hy = dy + head
  // tail
  line(g, 21, 27 + dy, 26, 25 + dy, 'd'); line(g, 26, 25 + dy, 27, 20 + dy - tail, 'd'); line(g, 27, 20 + dy - tail, 25, 18 + dy - tail, 'd')
  // feet, body, belly
  ell(g, 12.5, 29.5, 2.6, 1.4, 'd'); ell(g, 19.5, 29.5, 2.6, 1.4, 'd')
  ell(g, 16, 23.5 + dy / 2, 6, 6.5 - dy / 2, 'b'); ell(g, 16, 24.5 + dy / 2, 3.5, 4.5 - dy / 2, 'f')
  // headphone band behind the head
  ell(g, 16, 11 + hy, 9.6, 8.8, 'h', (x, y) => y <= 7 + hy)
  // head and face
  ell(g, 16, 11 + hy, 8.5, 7.5, 'b')
  ell(g, 16, 13.5 + hy, 6, 4.2, 'f'); ell(g, 13.3, 10.8 + hy, 2.9, 2.9, 'f'); ell(g, 18.7, 10.8 + hy, 2.9, 2.9, 'f')
  rect(g, 6, 9 + hy, 3, 6, 'c'); rect(g, 23, 9 + hy, 3, 6, 'c')
  EYES[eyes](g, 13, 10 + hy); EYES[eyes](g, 18, 10 + hy)
  MOUTHS[mouth](g, 14 + hy)
  if (cheeks) { rect(g, 11, 13 + hy, 2, 1, 'p'); rect(g, 19, 13 + hy, 2, 1, 'p') }
  // arms over the body
  line(g, 10, 20 + dy, left[0], left[1], 'b', 2); rect(g, left[0], left[1], 2, 2, 'f')
  line(g, 21, 20 + dy, right[0], right[1], 'b', 2); rect(g, right[0], right[1], 2, 2, 'f')
  extra?.(g, hy)
  if (cx === 0) return g
  const moved = blank()
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g[y][x] !== '.') set(moved, x + cx, y, g[y][x])
  return moved
}
const frame = p => outline(p.squash ? squash(paint(p), ...p.squash) : paint(p)).map(row => row.join(''))

const zzz = big => (g, hy) => {
  rect(g, 27, 6 + hy, 3, 1, 'm'); set(g, 28, 7 + hy, 'm'); rect(g, 27, 8 + hy, 3, 1, 'm')
  if (big) { rect(g, 28, 1 + hy, 2, 1, 'm'); set(g, 28, 2 + hy, 'm'); rect(g, 28, 3 + hy, 2, 1, 'm') }
}
const magnifier = x => g => { ell(g, x, 12, 4, 4, 'g'); ell(g, x, 12, 2.6, 2.6, 'm'); set(g, x - 1, 11, 'w'); line(g, x + 3, 15, x + 5, 19, 'g', 2) }
const pencil = (x, y) => g => { line(g, x, y, x + 4, y - 5, 'y', 2); rect(g, x, y + 1, 1, 1, 'k'); rect(g, x + 4, y - 6, 2, 2, 'p'); rect(g, 6, 27, 12, 4, 's'); line(g, 8, 28, 8 + (x % 5) + 3, 28, 'g') }
const keyboard = g => { rect(g, 6, 26, 20, 4, 'g'); for (let x = 7; x < 25; x += 2) { set(g, x, 27, 'k'); set(g, x + 1, 28, 'k') } }
const spyglass = dx => g => { rect(g, 3 + dx, 10, 10, 3, 'y'); rect(g, 2 + dx, 9, 2, 5, 'k'); rect(g, 12 + dx, 10, 2, 3, 'k'); set(g, 4 + dx, 10, 'w') }
const banana = y => g => { line(g, 17, y + 2, 21, y, 'y', 2); set(g, 22, y - 1, 'd'); set(g, 17, y + 3, 'd') }
const cloth = x => g => { rect(g, x, 20, 6, 4, 'm'); rect(g, x + 1, 21, 2, 1, 'w'); set(g, x - 2, 19, 'w'); set(g, x + 7, 24, 'w') }
const sweat = y => g => { set(g, 26, y, 'm'); rect(g, 25, y + 1, 3, 2, 'm'); set(g, 26, y + 1, 'w') }
const topHat = (g, hy) => { rect(g, 11, 0 + hy, 10, 4, 'k'); rect(g, 11, 3 + hy, 10, 1, 'r'); rect(g, 8, 4 + hy, 16, 1, 'k') }
const cap = (g, hy) => { ell(g, 16, 5 + hy, 8, 3.5, 'm', (x, y) => y <= 5 + hy); rect(g, 8, 5 + hy, 16, 1, 'm'); rect(g, 20, 6 + hy, 8, 1, 'r'); set(g, 16, 1 + hy, 'y') }
const bang = g => { rect(g, 28, 3, 2, 5, 'r'); rect(g, 28, 9, 2, 2, 'r') }
const sparkle = g => { set(g, 27, 12, 'y'); set(g, 29, 9, 'y'); set(g, 4, 6, 'y') }
const mini = g => {
  const small = paint({ eyes: 'happy', left: [7, 16], right: [24, 16] })
  for (let y = 0; y < N; y += 2) for (let x = 0; x < N; x += 2) if (small[y][x] !== '.') set(g, 18 + x / 2, 15 + y / 2, small[y][x])
}

const states = {
  idle: { fps: 2, frames: [{}, { head: 1 }, {}, { eyes: 'blink' }] },
  think: { fps: 2, frames: [{ eyes: 'up', mouth: 'flat', right: [19, 17] }, { eyes: 'up', mouth: 'flat', right: [19, 17], head: -1, tail: 1 }] },
  work: { fps: 4, frames: [{ mouth: 'flat', left: [7, 22], right: [23, 25] }, { mouth: 'flat', left: [9, 25], right: [25, 22] }] },
  happy: { fps: 4, frames: [{ eyes: 'happy', mouth: 'open', left: [6, 14], right: [25, 14], cheeks: true }, { eyes: 'happy', mouth: 'open', left: [5, 12], right: [26, 12], cheeks: true, head: -1, tail: 2 }] },
  sleep: { fps: 1, frames: [{ eyes: 'blink', mouth: 'flat', head: 2, extra: zzz(false) }, { eyes: 'blink', mouth: 'o', head: 3, extra: zzz(true) }] },
  tired: { fps: 1, frames: [{ eyes: 'half', mouth: 'flat', head: 2, extra: sweat(4) }, { eyes: 'half', mouth: 'o', head: 3, extra: sweat(6) }] },
  petted: { fps: 4, frames: [{ eyes: 'happy', cheeks: true, head: 1 }, { eyes: 'happy', cheeks: true, head: 2, tail: 2 }] },
  eat: { fps: 3, frames: [{ mouth: 'open', right: [20, 18], extra: banana(15) }, { eyes: 'happy', mouth: 'flat', right: [20, 17], cheeks: true, extra: banana(14) }] },
  sad: { fps: 1, frames: [{ eyes: 'down', mouth: 'frown', head: 2 }, { eyes: 'blink', mouth: 'frown', head: 2 }] },
  read: { fps: 2, frames: [{ mouth: 'o', right: [24, 19], extra: magnifier(19) }, { mouth: 'o', right: [26, 19], extra: magnifier(21) }] },
  write: { fps: 4, frames: [{ eyes: 'down', mouth: 'flat', left: [10, 25], extra: pencil(10, 25) }, { eyes: 'down', mouth: 'flat', left: [13, 25], extra: pencil(13, 25) }] },
  type: { fps: 6, frames: [{ eyes: 'down', mouth: 'flat', left: [9, 24], right: [21, 26], extra: keyboard }, { eyes: 'down', mouth: 'flat', left: [11, 26], right: [23, 24], extra: keyboard }] },
  search: { fps: 2, frames: [{ mouth: 'o', left: [8, 12], extra: spyglass(0) }, { mouth: 'o', left: [7, 12], head: -1, extra: spyglass(-1) }] },
  clone: { fps: 2, frames: [{ cx: -4, eyes: 'wide', mouth: 'o', right: [25, 16], extra: sparkle }, { cx: -4, eyes: 'happy', right: [25, 18], extra: mini }] },
  squash: { fps: 3, frames: [{ eyes: 'blink', mouth: 'flat', squash: [1.15, 0.75] }, { eyes: 'blink', mouth: 'o', squash: [1.3, 0.55] }] },
  wipe: { fps: 4, frames: [{ mouth: 'flat', right: [22, 21], extra: cloth(21) }, { mouth: 'flat', right: [25, 21], extra: cloth(24) }] },
  hat: { fps: 1, frames: [{ dy: 3, extra: topHat }, { dy: 3, eyes: 'happy', extra: cap }] },
  copy: { fps: 3, frames: [{ eyes: 'wide', mouth: 'o', left: [6, 15], extra: bang }, { eyes: 'happy', mouth: 'open', right: [25, 15], extra: bang }] },
}

const character = {
  schemaVersion: 1, name: 'monkey', author: 'code-critter', license: 'MIT', size: N, palette: PALETTE,
  states: Object.fromEntries(Object.entries(states).map(([name, s]) => [name, { fps: s.fps, frames: s.frames.map(frame) }])),
}
// One frame per line keeps the file diffable.
const json = JSON.stringify(character, null, 1).replace(/\[\n\s+"/g, '["').replace(/",\n\s+"(?=[.a-z]{32}")/g, '","').replace(/"\n\s+\]/g, '"]')
writeFileSync(new URL('../characters/monkey/character.json', import.meta.url), json + '\n')
console.log(`monkey: ${Object.keys(states).length} states, ${Object.values(states).reduce((n, s) => n + s.frames.length, 0)} frames`)
