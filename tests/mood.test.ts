import { expect, test } from 'claude-code/testing'
import { FEED_COOLDOWN, HOUR, canFeed, feed, level, moodAt, pet, turnDone } from '../hooks/mood'

const start = { mood: 60, moodAt: 0, fedAt: -FEED_COOLDOWN }

test('mood holds for two hours, then falls three points an hour, never below 0', async () => {
  expect(moodAt(start, 2 * HOUR)).toBe(60)
  expect(moodAt(start, 4 * HOUR)).toBe(54)
  expect(moodAt(start, 1000 * HOUR)).toBe(0)
})

test('feeding adds 25 and then waits out a cooldown', async () => {
  const fed = feed(start, 1000)
  expect(fed.mood).toBe(85)
  expect(canFeed(fed, 1000 + FEED_COOLDOWN - 1)).toBe(false)
  expect(feed(fed, 2000)).toBe(fed)
  expect(feed(fed, 1000 + FEED_COOLDOWN).mood).toBe(100)
})

test('petting and a finished turn add a little, capped at 100', async () => {
  expect(pet(start, 0).mood).toBe(62)
  expect(turnDone(start, 0).mood).toBe(61)
  expect(pet({ ...start, mood: 100 }, 0).mood).toBe(100)
})

test('decay is applied before a gain', async () => {
  expect(pet(start, 4 * HOUR)).toEqual({ mood: 56, moodAt: 4 * HOUR, fedAt: start.fedAt })
})

test('levels', async () => {
  expect([level(70), level(69), level(30), level(29)]).toEqual(['happy', 'ok', 'ok', 'bored'])
})
