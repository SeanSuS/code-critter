import { expect, test } from 'claude-code/testing'
import { HOUR, level, moodAt, turnDone } from '../hooks/mood'

const start = { mood: 60, moodAt: 0 }

test('mood holds for two hours, then falls three points an hour, never below 0', async () => {
  expect(moodAt(start, 2 * HOUR)).toBe(60)
  expect(moodAt(start, 4 * HOUR)).toBe(54)
  expect(moodAt(start, 1000 * HOUR)).toBe(0)
})

test('a finished turn adds two, after the decay, capped at 100', async () => {
  expect(turnDone(start, 0)).toEqual({ mood: 62, moodAt: 0 })
  expect(turnDone(start, 4 * HOUR)).toEqual({ mood: 56, moodAt: 4 * HOUR })
  expect(turnDone({ mood: 100, moodAt: 0 }, 0).mood).toBe(100)
})

test('levels', async () => {
  expect([level(70), level(69), level(30), level(29)]).toEqual(['happy', 'ok', 'ok', 'bored'])
})
