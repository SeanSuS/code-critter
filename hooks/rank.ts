// Which slash commands to offer: the most used, recent use weighing more.
export type Use = { score: number; at: number }
export type Uses = Record<string, Use>

export const HALF_LIFE = 30 * 24 * 3_600_000
export const SLOTS = 6
export const DEFAULTS = ['compact', 'clear', 'model', 'context', 'review', 'explain']
export const CONTEXT_HIGH = 80

const decayed = (use: Use, now: number) => use.score * 0.5 ** (Math.max(0, now - use.at) / HALF_LIFE)

export function recordUse(uses: Uses, command: string, now: number): Uses {
  const before = uses[command]
  return { ...uses, [command]: { score: (before ? decayed(before, now) : 0) + 1, at: now } }
}

// The commands to show, best first: used ones by decayed score, then the
// defaults for any slot left; /compact leads while the context is nearly full.
export function recommend(uses: Uses, now: number, contextPercent?: number): string[] {
  const used = Object.entries(uses)
    .map(([command, use]) => ({ command, score: decayed(use, now) }))
    .sort((a, b) => b.score - a.score || a.command.localeCompare(b.command))
    .map(one => one.command)
  const list = [...new Set([...used, ...DEFAULTS])]
  if (contextPercent !== undefined && contextPercent >= CONTEXT_HIGH) list.unshift('compact')
  return [...new Set(list)].slice(0, SLOTS)
}
