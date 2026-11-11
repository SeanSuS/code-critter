// The pet's mood, 0-100. It never dies: the floor is 0, shown as bored.
export const HOUR = 3_600_000
export const FEED_COOLDOWN = 30 * 60_000
const GRACE = 2 * HOUR
const DECAY_PER_HOUR = 3
const FEED = 25
const PET = 2
const TURN = 1

export type Mood = { mood: number; moodAt: number; fedAt: number }
export type MoodLevel = 'happy' | 'ok' | 'bored'

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

// Mood as of `now`: unchanged for two hours after it was last touched, then
// falling three points an hour. Computed from the stored time, so it is right
// after the app was closed.
export function moodAt(m: Mood, now: number): number {
  const idle = Math.max(0, now - m.moodAt - GRACE)
  return clamp(m.mood - (idle / HOUR) * DECAY_PER_HOUR)
}
const touch = (m: Mood, now: number, gain: number): Mood => ({ ...m, mood: clamp(moodAt(m, now) + gain), moodAt: now })

export const canFeed = (m: Mood, now: number) => now - m.fedAt >= FEED_COOLDOWN
export const feed = (m: Mood, now: number): Mood => (canFeed(m, now) ? { ...touch(m, now, FEED), fedAt: now } : m)
export const pet = (m: Mood, now: number): Mood => touch(m, now, PET)
export const turnDone = (m: Mood, now: number): Mood => touch(m, now, TURN)
export const level = (mood: number): MoodLevel => (mood >= 70 ? 'happy' : mood >= 30 ? 'ok' : 'bored')
