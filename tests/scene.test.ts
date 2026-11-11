import { expect, test } from 'claude-code/testing'
import { SVG_LIMIT, frameRects, scene, wrapBubble } from '../hooks/scene'
import type { Character } from '../hooks/character'

const frame = (ch: string) => Array(16).fill(ch.repeat(16)) as string[]
const c: Character = { schemaVersion: 1, name: 'blob', size: 16, palette: { k: '#000000', w: '#ffffff' }, states: { idle: { frames: [frame('k'), frame('w')], fps: 2 }, sleep: { frames: [frame('k')] } } }

test('a row becomes one rect per run of a colour, transparent cells skipped', async () => {
  expect(frameRects(['kk.w'], c.palette)).toBe('<rect x="0" y="0" width="2" height="1" fill="#000000"/><rect x="3" y="0" width="1" height="1" fill="#ffffff"/>')
})

test('frames animate; one frame does not', async () => {
  expect(scene({ character: c, state: 'idle', hearts: false })).toContain('values="inline;none"')
  expect(scene({ character: c, state: 'sleep', hearts: false })).not.toContain('attributeName="display"')
})

test('usage is drawn only when known', async () => {
  const bare = scene({ character: c, state: 'idle', hearts: false })
  expect(bare).not.toContain('ctx ')
  expect(bare).not.toContain('5h ')
  const full = scene({ character: c, state: 'idle', hearts: true, context: 82, fiveHour: 30, sevenDay: 12 })
  expect(full).toContain('ctx 82%')
  expect(full).toContain('5h 30%')
  expect(full).toContain('7d 12%')
})

test('bubble text is escaped and kept to two lines', async () => {
  expect(scene({ character: c, state: 'idle', hearts: false, bubble: '<b>&' })).toContain('&#60;b&#62;&#38;')
  expect(wrapBubble('context 快滿了，要壓縮一下嗎？')).toHaveLength(2)
  expect(wrapBubble('一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十').at(-1)?.endsWith('…')).toBe(true)
})

test('a character too noisy for the Svg limit is drawn still, not dropped', async () => {
  const big: Character = { ...c, size: 32, states: { idle: { frames: Array(8).fill(Array(32).fill('kw'.repeat(16))) } } }
  const drawn = scene({ character: big, state: 'idle', hearts: true, context: 99, fiveHour: 99, sevenDay: 99, bubble: 'x'.repeat(60) })
  expect(drawn.length).toBeLessThan(SVG_LIMIT)
  expect(drawn).not.toContain('attributeName="display"')
  expect(drawn).toContain('<rect x="0" y="31"')
})
