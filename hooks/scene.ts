// The pane's picture: the pet at its desk, drawn as one SVG. Usage is part of
// the room: the paper stack is the context window, the bananas are what is
// left of each rate limit.
import { resolveAnimation } from './character'
import type { Character } from './character'

export type SceneInput = {
  character: Character
  state: string
  bubble?: string
  hearts: boolean
  context?: number
  fiveHour?: number
  sevenDay?: number
}

export const SCENE_WIDTH = 160
export const SCENE_HEIGHT = 100
const SPRITE = 48
const FLOOR = 80
const AT_DESK = new Set(['think', 'work', 'read', 'write', 'type', 'search', 'clone'])

const esc = (text: string) => text.replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`)
// Rough drawn width of a string in units of one CJK character.
const widthOf = (text: string) => [...text].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2e7f ? 1 : 0.55), 0)

// One frame as rects, runs of one colour merged.
export function frameRects(rows: string[], palette: Record<string, string>): string {
  let out = ''
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ch = row[x] as string
      let run = 1
      while (row[x + run] === ch) run += 1
      const fill = palette[ch]
      if (fill !== undefined) out += `<rect x="${x}" y="${y}" width="${run}" height="1" fill="${fill}"/>`
      x += run
    }
  })
  return out
}

function sprite(c: Character, state: string, still: boolean): string {
  const animation = resolveAnimation(c, state)
  const frames = still ? animation.frames.slice(0, 1) : animation.frames
  const fps = animation.fps
  const duration = frames.length / fps
  return frames.map((rows, i) => {
    const rects = frameRects(rows, c.palette)
    if (frames.length === 1) return `<g>${rects}</g>`
    const values = frames.map((_, j) => (j === i ? 'inline' : 'none')).join(';')
    return `<g display="${i === 0 ? 'inline' : 'none'}">${rects}<animate attributeName="display" values="${values}" dur="${duration}s" calcMode="discrete" repeatCount="indefinite"/></g>`
  }).join('')
}

// Up to two lines that fit the bubble.
export function wrapBubble(text: string, max = 11): string[] {
  const lines: string[] = []
  let line = ''
  for (const ch of text) {
    if (widthOf(line + ch) > max) {
      // Break at a space when one is near the end; else mid-word, as CJK text wraps.
      const space = line.lastIndexOf(' ')
      const cut = space > 0 && line.length - space <= 6 ? space : -1
      lines.push(cut > 0 ? line.slice(0, cut) : line)
      line = (cut > 0 ? line.slice(cut + 1) : '') + ch
    } else line += ch
  }
  if (line) lines.push(line)
  if (lines.length <= 2) return lines
  return [lines[0] as string, `${(lines[1] as string).slice(0, -1)}…`]
}

function bubble(text: string): string {
  const lines = wrapBubble(text)
  const height = 8 + lines.length * 9
  const rows = lines.map((line, i) => `<text x="9" y="${15 + i * 9}" font-size="7" font-family="sans-serif" fill="#22252e">${esc(line)}</text>`).join('')
  return `<g><animate attributeName="opacity" from="0" to="1" dur="0.25s" fill="freeze"/><rect x="4" y="4" width="88" height="${height}" rx="4" fill="#fdfdf8"/><path d="M22 ${4 + height} l4 6 l4 -6 z" fill="#fdfdf8"/>${rows}</g>`
}

const heart = (x: number, delay: number) =>
  `<path d="M0 2 a2 2 0 0 1 4 0 a2 2 0 0 1 4 0 q0 3 -4 6 q-4 -3 -4 -6 z" fill="#e58c8c" opacity="0"><animateTransform attributeName="transform" type="translate" values="${x},44;${x},26" dur="1.6s" begin="${delay}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="1.6s" begin="${delay}s" repeatCount="indefinite"/></path>`

// Ten bananas, the ones already eaten drawn as outlines.
function bananas(label: string, used: number, y: number): string {
  const left = 10 - Math.min(10, Math.max(0, Math.round(used / 10)))
  let out = `<text x="98" y="${y + 6}" font-size="6" font-family="sans-serif" fill="#e8e6da">${esc(label)} ${Math.round(used)}%</text>`
  for (let i = 0; i < 10; i++) {
    const x = 98 + i * 5.6
    out += i < left
      ? `<path d="M${x} ${y + 9} q1.5 5 4.5 2" stroke="#f2c94c" stroke-width="2" fill="none" stroke-linecap="round"/>`
      : `<path d="M${x} ${y + 9} q1.5 5 4.5 2" stroke="#59607a" stroke-width="1" fill="none" stroke-linecap="round"/>`
  }
  return out
}

function papers(percent: number): string {
  const sheets = Math.min(10, Math.max(0, Math.round(percent / 10)))
  const fill = percent >= 80 ? '#f3b8a8' : '#f8f8f2'
  let out = ''
  for (let i = 0; i < sheets; i++) out += `<rect x="${100 + (i % 2)}" y="${56 - i * 2}" width="14" height="1.6" fill="${fill}"/>`
  const top = 56 - sheets * 2
  return `${out}<text x="100" y="${top - 1}" font-size="6" font-family="sans-serif" fill="#e8e6da">ctx ${Math.round(percent)}%<animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite"/></text>`
}

// The Svg element refuses a longer source, and a refused source blanks the pane.
export const SVG_LIMIT = 131072

// A noisy character can outgrow the limit: then it is drawn still, first frame only.
export function scene(input: SceneInput): string {
  const moving = draw(input, false)
  return moving.length <= SVG_LIMIT ? moving : draw(input, true)
}

function draw(input: SceneInput, still: boolean): string {
  const c = input.character
  const scale = SPRITE / c.size
  const top = FLOOR + 3 - SPRITE
  const walks = input.state === 'idle'
  const x = AT_DESK.has(input.state) ? 62 : 30
  const walk = walks ? `<animateTransform attributeName="transform" type="translate" values="6,${top};52,${top};52,${top};6,${top};6,${top}" keyTimes="0;0.4;0.5;0.9;1" dur="14s" repeatCount="indefinite"/>` : ''
  const pet = `<g transform="translate(${walks ? 6 : x},${top})">${walk}<g class="hop"><g transform="scale(${scale})">${sprite(c, input.state, still)}</g></g></g>`
  const room =
    `<rect width="${SCENE_WIDTH}" height="${SCENE_HEIGHT}" fill="#2b3040"/>` +
    `<rect y="${FLOOR}" width="${SCENE_WIDTH}" height="${SCENE_HEIGHT - FLOOR}" fill="#6b4f3a"/><rect y="${FLOOR}" width="${SCENE_WIDTH}" height="1.5" fill="#57402f"/>` +
    // desk and monitor
    `<rect x="96" y="58" width="60" height="4" fill="#a8763f"/><rect x="100" y="62" width="3" height="22" fill="#8a5f33"/><rect x="149" y="62" width="3" height="22" fill="#8a5f33"/>` +
    `<rect x="120" y="34" width="30" height="20" rx="1.5" fill="#1b1d26"/><rect x="122" y="36" width="26" height="16" fill="#243b53"/><rect x="133" y="54" width="4" height="4" fill="#1b1d26"/>` +
    `<rect x="124" y="39" width="14" height="1.5" fill="#7fd1b9"><animate attributeName="width" values="4;14;14" dur="2.4s" repeatCount="indefinite"/></rect>` +
    `<rect x="124" y="43" width="18" height="1.5" fill="#f2c94c"><animate attributeName="width" values="2;18;18" dur="3.1s" repeatCount="indefinite"/></rect>` +
    `<rect x="124" y="47" width="9" height="1.5" fill="#e58c8c"><animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite"/></rect>`
  const usage =
    (input.context === undefined ? '' : papers(input.context)) +
    (input.fiveHour === undefined ? '' : bananas('5h', input.fiveHour, 3)) +
    (input.sevenDay === undefined ? '' : bananas('7d', input.sevenDay, 17))
  const hearts = input.hearts ? heart(40, 0) + heart(52, 0.8) : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}" width="${SCENE_WIDTH * 2}" height="${SCENE_HEIGHT * 2}" shape-rendering="crispEdges"><style>.hop{transition:transform .15s}svg:hover .hop{transform:translateY(-4px)}</style>${room}${usage}${pet}${hearts}${input.bubble ? bubble(input.bubble) : ''}</svg>`
}
