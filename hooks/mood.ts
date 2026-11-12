// The pet's mood, 0-100. It never dies: the floor is 0, shown as bored.
export const HOUR = 3_600_000
const GRACE = 2 * HOUR
const DECAY_PER_HOUR = 3
const TURN = 2

export type Mood = { mood: number; moodAt: number }
export type MoodLevel = 'happy' | 'ok' | 'bored'

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

// Mood as of `now`: unchanged for two hours after it was last touched, then
// falling three points an hour. Computed from the stored time, so it is right
// after the app was closed.
export function moodAt(m: Mood, now: number): number {
  const idle = Math.max(0, now - m.moodAt - GRACE)
  return clamp(m.mood - (idle / HOUR) * DECAY_PER_HOUR)
}

// Working together is what cheers the pet up: each finished turn adds a little.
export const turnDone = (m: Mood, now: number): Mood => ({ mood: clamp(moodAt(m, now) + TURN), moodAt: now })
export const level = (mood: number): MoodLevel => (mood >= 70 ? 'happy' : mood >= 30 ? 'ok' : 'bored')
