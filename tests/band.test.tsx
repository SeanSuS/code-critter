import { expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'
import type { On } from 'claude-code'

const BAND = {
  plugin: 'code-critter', component: 'AbovePrompt',
  props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 20, bodyColumns: 80, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

const row = 'k'.repeat(16)
const blob = (name: string) => ({ schemaVersion: 1, name, size: 16, palette: { k: '#000000' }, states: { idle: { frames: [Array(16).fill(row), Array(16).fill('.'.repeat(15) + 'k')] } } })
const broken = { ...blob('broken'), states: { idle: { frames: [[...Array(15).fill(row), 'kkkz']] } } }

type World = {
  clock: MockClock
  during?: () => Promise<void>
  mod: Record<string, unknown>
  mine: Record<string, unknown>
  store: Map<string, unknown>
  ran: string[]
  prompts: string[]
  statuses: (string | undefined)[]
  env: Record<string, string>
  usage: { context: { window: number; percent?: number }; rateLimits: { kind: string; percentUsed: number; resetsAt?: string }[]; cost?: { usd: number } }
}

// Stands for the engine and the disk beneath the mod: `mod` is the mod's own
// characters folder, `mine` the person's.
function world(on: On, seed: Partial<World> = {}): World {
  const w: World = {
    mod: { monkey: blob('monkey') }, mine: {},
    store: new Map(), ran: [], prompts: [], statuses: [],
    env: { HOME: '/home/u', LANG: 'en_US.UTF-8' },
    usage: { context: { window: 200000 }, rateLimits: [] },
    clock: mock.clock(on, { now: Date.parse('2026-01-01T00:00:00Z') }),
    ...seed,
  }
  const folder = (path: string) => (path.startsWith('/home/u/') ? w.mine : w.mod)
  on('store.get', (_, e) => ({ value: w.store.get(e.key) }))
  on('store.set', (_, e) => { w.store.set(e.key, e.value); return { value: undefined } })
  on('env.get', (_, e) => ({ value: w.env[e.name] }))
  on('fs.exists', (_, e) => ({ value: Object.keys(folder(String(e.path))).length > 0 }))
  on('fs.list', (_, e) => ({ value: Object.keys(folder(String(e.path))).map(name => ({ name, kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false })) }))
  on('fs.read', (_, e) => {
    const path = String(e.path)
    const found = folder(path)[path.split('/').at(-2) as string]
    if (found === undefined) throw new Error('ENOENT')
    return { value: typeof found === 'string' ? found : JSON.stringify(found) }
  })
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('command.run', (_, e) => { w.ran.push(e.command); return { text: 'ok' } })
  on('prompt.submit', (_, e) => { w.prompts.push(e.text); return { text: e.text } })
  on('ui.status', (_, e) => { w.statuses.push(e.text); return { value: undefined } })
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.model', () => ({ value: 'claude-test' }))
  on('session.usage', () => ({ value: { startedAt: 0, ...w.usage } }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('tool.call', async () => { await w.during?.(); return { result: {} } })
  on('turn.complete', (_, e) => ({ text: e.answer }))
  return w
}

const start = ($: Engine) => $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
const typed = ($: Engine, command: string, args = '') => $.command.run({ command, args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
const measure = ($: Engine, w: World) => $.session.measure({ ...w.usage, changed: ['context'] })
const svg = async (ui: { find: (q: { type: 'Svg' }) => Promise<unknown> }) => JSON.stringify(await ui.find({ type: 'Svg' }))

test('the band draws the pet, usage and six default commands above the prompt', async ($, on) => {
  const w = world(on, { usage: { context: { window: 200000, percent: 42 }, rateLimits: [{ kind: 'five_hour', percentUsed: 30 }, { kind: 'seven_day', percentUsed: 12 }] } })
  await start($)
  expect(w.statuses.at(-1)).toBe('🐒 ctx 42% · 5h 30%')

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const picture = await svg(ui)
  expect(picture).toContain('ctx 42%')
  expect(picture).toContain('5h 30%')
  expect(picture).toContain('7d 12%')
  for (const command of ['compact', 'clear', 'model', 'context', 'review', 'explain'])
    expect(await ui.find({ key: `run-${command}` })).toBeDefined()
  expect(await ui.find({ key: 'nudge-run' })).toBeUndefined()
  await ui.unmount()

  // A terminal has no Svg: the controls alone.
  const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await term.find({ type: 'Svg' })).toBeUndefined()
  expect(await term.find({ key: 'run-compact' })).toBeDefined()
  await term.unmount()
})

test('a command button runs the command at once and counts it; /clear takes two presses', async ($, on) => {
  const w = world(on)
  await start($)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await ui.press({ key: 'run-model' })
  expect(w.ran).toEqual(['model'])
  expect((w.store.get('pet') as { uses: Record<string, { score: number }> }).uses['model']?.score).toBe(1)

  await ui.press({ key: 'run-clear' })
  expect(w.ran).not.toContain('clear')
  expect((await ui.find({ key: 'run-clear' }))?.text).toBe('Really clear?')
  await ui.press({ key: 'run-clear' })
  expect(w.ran).toContain('clear')

  // A template goes to Claude as a prompt, with nothing to paste.
  await ui.press({ key: 'run-explain' })
  await w.clock.advance(1)
  expect(w.prompts.at(-1)).toContain('Explain the code')
  await ui.unmount()
})

test('commands the person types are counted by name and move up the list', async ($, on) => {
  const w = world(on)
  await start($)
  await typed($, 'deploy')
  await typed($, 'deploy')
  await typed($, 'pet', 'help')
  const uses = (w.store.get('pet') as { uses: Record<string, { score: number }> }).uses
  expect(uses['deploy']?.score).toBe(2)
  expect(uses['pet']).toBeUndefined()

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ key: 'run-deploy' })).toBeDefined()
  expect(await ui.find({ key: 'run-explain' })).toBeUndefined()
  // The pet repeats the command it just saw.
  expect(await svg(ui)).toContain('/deploy!')
  await ui.unmount()
})

test('a nearly full context brings a one-press /compact nudge that can be closed', async ($, on) => {
  const w = world(on, { usage: { context: { window: 200000, percent: 85 }, rateLimits: [] } })
  await start($)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await svg(ui)).toContain('Context is nearly')
  await ui.press({ key: 'nudge-run' })
  expect(w.ran).toEqual(['compact'])

  await ui.press({ key: 'nudge-dismiss' })
  expect(await ui.find({ key: 'nudge-run' })).toBeUndefined()
  // Closed stays closed while the context stays high…
  w.usage.context.percent = 88
  await measure($, w)
  expect(await ui.find({ key: 'nudge-run' })).toBeUndefined()
  // …and comes back after it has dropped and filled again.
  w.usage.context.percent = 20
  await measure($, w)
  w.usage.context.percent = 81
  await measure($, w)
  expect(await ui.find({ key: 'nudge-run' })).toBeDefined()

  await typed($, 'pet', 'mute')
  expect(await ui.find({ key: 'nudge-run' })).toBeUndefined()
  expect(await svg(ui)).not.toContain('Context is nearly')
  await ui.unmount()
})

test('a rate limit at 90% is a notice with no command to run', async ($, on) => {
  world(on, { usage: { context: { window: 200000, percent: 10 }, rateLimits: [{ kind: 'five_hour', percentUsed: 93 }] } })
  await start($)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await svg(ui)).toContain('5-hour limit is at')
  expect(await ui.find({ key: 'nudge-run' })).toBeUndefined()
  await ui.press({ key: 'nudge-dismiss' })
  expect(await svg(ui)).not.toContain('5-hour limit')
  await ui.unmount()
})

test('a character dropped in the user folder loads on /pet reload; a broken one is reported and skipped', async ($, on) => {
  const w = world(on)
  await start($)
  w.mine['blob'] = blob('blob')
  w.mine['broken'] = broken
  w.mine['garbage'] = '{not json'
  const out = await typed($, 'pet', 'reload')
  expect(out.text).toContain('2 characters loaded.')
  expect(out.text).toContain('broken: state "idle" frame 1 row 16: 4 chars, expected 16')
  expect(out.text).toContain('garbage: ')

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /row 16: "z" is not in the palette/ })).toBeDefined()
  expect((await typed($, 'pet', 'char nobody')).text).toContain('No character named "nobody"')
  expect((await typed($, 'pet', 'char blob')).text).toBe('Character: blob.')
  expect((w.store.get('pet') as { char: string }).char).toBe('blob')
  expect(await svg(ui)).toContain('blob the desk pet')
  await ui.unmount()
})

test('a saved character that is gone falls back to the monkey', async ($, on) => {
  const w = world(on)
  w.store.set('pet', { char: 'vanished' })
  await start($)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await svg(ui)).toContain('monkey the desk pet')
  await ui.unmount()
})

test("the pet acts out Claude's tools, and cheers when the turn ends", async ($, on) => {
  const w = world(on)
  let during = ''
  await start($)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  w.during = async () => { during = await svg(ui) }
  await $.tool.call({ tool: 'Read', file_path: '/x' })
  expect(during).toContain('the desk pet: read')
  expect(await svg(ui)).toContain('the desk pet: think')
  await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' })
  expect(await svg(ui)).toContain('the desk pet: happy')
  expect((w.store.get('pet') as { mood: number }).mood).toBe(72)
  await ui.unmount()
})

test('the language follows /pet lang, and the system when left on auto', async ($, on) => {
  world(on)
  await start($)
  expect((await typed($, 'pet', 'help')).text).toContain('show or hide')
  expect((await typed($, 'pet', 'lang zh-TW')).text).toBe('語言：zh-TW。')
  expect((await typed($, 'pet', 'help')).text).toContain('顯示或隱藏')
  expect((await typed($, 'pet', 'lang klingon')).text).toContain('用法')
})

test('/pet hides and shows the band, and the choice is kept', async ($, on) => {
  const w = world(on)
  await start($)
  expect((await typed($, 'pet')).text).toBe('Pet hidden.')
  expect((w.store.get('pet') as { isHidden: boolean }).isHidden).toBe(true)
  const hidden = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await hidden.find({ type: 'Svg' })).toBeUndefined()
  await hidden.unmount()
  expect((await typed($, 'pet')).text).toBe('Pet shown.')
  const shown = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await shown.find({ type: 'Svg' })).toBeDefined()
  await shown.unmount()
})

test('/pet create asks Claude to draw a character and loads it when the turn ends', async ($, on) => {
  const w = world(on)
  await start($)
  expect((await typed($, 'pet', 'create')).text).toContain('Usage')
  await typed($, 'pet', 'create a sleepy blue owl')
  await w.clock.advance(1)
  expect(w.prompts.at(-1)).toContain('CHARACTER_PROMPT.md')
  expect(w.prompts.at(-1)).toContain('a sleepy blue owl')
  expect(w.prompts.at(-1)).toContain('/home/u/.claude/code-critter/characters/<name>/character.json')
  // A turn that was already running ends first: nothing new yet, so the pet keeps waiting.
  await $.turn.complete({ answer: 'earlier', durationMs: 1, isAborted: false, turnId: 's', reason: 'answer' })
  w.mine['owl'] = blob('owl')
  await $.turn.complete({ answer: 'owl', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' })
  expect((await typed($, 'pet', 'char owl')).text).toBe('Character: owl.')
})

test('/pet reset clears the usage history', async ($, on) => {
  const w = world(on)
  await start($)
  await typed($, 'deploy')
  await typed($, 'pet', 'reset')
  expect((w.store.get('pet') as { uses: object }).uses).toEqual({})
})
