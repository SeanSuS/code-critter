import { expect, test } from 'claude-code/testing'
import { resolveAnimation, validateCharacter } from '../hooks/character'
import type { Character } from '../hooks/character'

const row = 'k'.repeat(16)
const frame = Array(16).fill(row) as string[]
const good = { schemaVersion: 1, name: 'blob', size: 16, palette: { k: '#000000' }, states: { idle: { frames: [frame] } } }

test('a well-formed character passes', async () => {
  expect(validateCharacter(good).ok).toBe(true)
})

test('errors name the state, frame and row', async () => {
  const bad = { ...good, states: { idle: { frames: [[...frame.slice(0, 15), 'kkkz']] } } }
  const checked = validateCharacter(bad)
  expect(checked.ok).toBe(false)
  if (checked.ok) return
  expect(checked.errors).toContain('state "idle" frame 1 row 16: 4 chars, expected 16')
  expect(checked.errors).toContain('state "idle" frame 1 row 16: "z" is not in the palette')
})

test('idle is required, sizes are 16, 24 or 32, and at most 8 frames', async () => {
  const noIdle = validateCharacter({ ...good, states: { walk: { frames: [frame] } } })
  expect(noIdle.ok ? [] : noIdle.errors).toContain('state "idle" with frames is required')
  const odd = validateCharacter({ ...good, size: 20 })
  expect(odd.ok ? [] : odd.errors).toContain('size must be 16, 24 or 32 (got 20)')
  const many = validateCharacter({ ...good, states: { idle: { frames: Array(9).fill(frame) } } })
  expect(many.ok ? [] : many.errors).toContain('state "idle": 1-8 frames (got 9)')
})

test('junk is refused without throwing', async () => {
  for (const junk of [null, 3, 'x', [], { states: 4 }, { ...good, states: { idle: { frames: [3] } } }])
    expect(validateCharacter(junk).ok).toBe(false)
})

test('a missing state falls back: its own fallbackTo, the built-in chain, then idle', async () => {
  const work = [Array(16).fill('.'.repeat(16)) as string[]]
  const c = { ...good, states: { idle: { frames: [frame], fps: 3 }, work: { frames: work }, nap: { fallbackTo: 'work' } } } as Character
  expect(resolveAnimation(c, 'read').frames).toBe(work)
  expect(resolveAnimation(c, 'nap').frames).toBe(work)
  expect(resolveAnimation(c, 'squash')).toEqual({ frames: [frame], fps: 3 })
  expect(resolveAnimation(c, 'never-heard-of-it').frames).toEqual([frame])
})
