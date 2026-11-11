// A character file (schemaVersion 1): a palette and, per state, frames of
// `size` strings of `size` characters. "." is transparent.
export type CharacterState = { frames?: string[][]; fps?: number; fallbackTo?: string }
export type Character = {
  schemaVersion: 1
  name: string
  author?: string
  license?: string
  size: number
  palette: Record<string, string>
  states: Record<string, CharacterState>
}
export type Animation = { frames: string[][]; fps: number }

export const SIZES = [16, 24, 32]
export const MAX_FRAMES = 8
const MAX_ERRORS = 20

// Where a state the character did not draw falls back to; every chain ends at idle.
const DEFAULT_FALLBACK: Record<string, string> = {
  read: 'work', write: 'work', type: 'work', search: 'work', clone: 'work',
  squash: 'copy', wipe: 'copy', hat: 'copy',
}

const lowestRow = (rows: string[]) => rows.reduce((found, row, y) => (/[^.]/.test(row) ? y : found), -1)

export function validateCharacter(raw: unknown): { ok: true; character: Character } | { ok: false; errors: string[] } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, errors: ['not a JSON object'] }
  const c = raw as Partial<Character>
  const errors: string[] = []
  if (c.schemaVersion !== 1) errors.push(`schemaVersion must be 1 (got ${String(c.schemaVersion)})`)
  if (typeof c.name !== 'string' || !/^[a-z0-9-]{1,32}$/.test(c.name)) errors.push('name must be 1-32 characters of a-z, 0-9 and "-"')
  const size = c.size as number
  if (!SIZES.includes(size)) errors.push(`size must be 16, 24 or 32 (got ${String(c.size)})`)
  const palette = typeof c.palette === 'object' && c.palette !== null ? c.palette : {}
  for (const [key, colour] of Object.entries(palette)) {
    if (key.length !== 1 || key === '.') errors.push(`palette key "${key}" must be one character other than "."`)
    if (typeof colour !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(colour)) errors.push(`palette "${key}" must be #rrggbb (got ${String(colour)})`)
  }
  if (Object.keys(palette).length > 16) errors.push('palette has more than 16 colours')
  const states = typeof c.states === 'object' && c.states !== null ? c.states : {}
  if (!Array.isArray(states['idle']?.frames)) errors.push('state "idle" with frames is required')
  for (const [name, state] of Object.entries(states)) {
    if (typeof state !== 'object' || state === null) { errors.push(`state "${name}" must be an object`); continue }
    if (state.fps !== undefined && !(state.fps > 0 && state.fps <= 10)) errors.push(`state "${name}": fps must be above 0 and at most 10`)
    if (state.frames === undefined) {
      if (!state.fallbackTo || !Array.isArray(states[state.fallbackTo]?.frames)) errors.push(`state "${name}" has no frames and no fallbackTo naming a state with frames`)
      continue
    }
    if (!Array.isArray(state.frames) || state.frames.length < 1 || state.frames.length > MAX_FRAMES) {
      errors.push(`state "${name}": 1-${MAX_FRAMES} frames (got ${Array.isArray(state.frames) ? state.frames.length : 'none'})`)
      continue
    }
    const feet = Array.isArray(state.frames[0]) ? lowestRow(state.frames[0].map(String)) : -1
    state.frames.forEach((rows, f) => {
      if (!Array.isArray(rows) || rows.some(row => typeof row !== 'string')) { errors.push(`state "${name}" frame ${f + 1}: must be a list of strings`); return }
      if (rows.length !== size) errors.push(`state "${name}" frame ${f + 1}: ${rows.length} rows, expected ${size}`)
      rows.forEach((row, y) => {
        if (row.length !== size) errors.push(`state "${name}" frame ${f + 1} row ${y + 1}: ${row.length} chars, expected ${size}`)
        for (const ch of new Set(row)) if (ch !== '.' && !(ch in palette)) errors.push(`state "${name}" frame ${f + 1} row ${y + 1}: "${ch}" is not in the palette`)
      })
      const low = lowestRow(rows)
      if (Math.abs(low - feet) > 2) errors.push(`state "${name}" frame ${f + 1}: lowest painted row ${low + 1} is more than 2 rows from frame 1's (${feet + 1})`)
    })
  }
  if (errors.length > MAX_ERRORS) return { ok: false, errors: [...errors.slice(0, MAX_ERRORS), `…and ${errors.length - MAX_ERRORS} more`] }
  return errors.length ? { ok: false, errors } : { ok: true, character: c as Character }
}

// The frames to play for `state`: its own, else the character's fallbackTo,
// else the built-in chain, else idle.
export function resolveAnimation(c: Character, state: string): Animation {
  const seen = new Set<string>()
  let name = state
  while (!seen.has(name)) {
    seen.add(name)
    const found = c.states[name]
    if (found?.frames) return { frames: found.frames, fps: found.fps ?? 2 }
    name = found?.fallbackTo ?? DEFAULT_FALLBACK[name] ?? 'idle'
  }
  const idle = c.states['idle']
  return { frames: idle?.frames ?? [], fps: idle?.fps ?? 2 }
}
