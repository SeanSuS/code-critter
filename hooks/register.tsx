import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Activity, Saved, Usage, View } from '../types'
import { validateCharacter } from './character'
import type { Character } from './character'
import { pickLocale, strings, until } from './i18n'
import type { Lang } from './i18n'
import { commandState, toolState } from './mimic'
import { level, moodAt, turnDone } from './mood'
import { CONTEXT_HIGH, recommend, recordUse } from './rank'
import { scene } from './scene'

const BUILT_IN = 'monkey'
const LIMIT_HIGH = 90
const SLEEP_AFTER = 10 * 60_000
const USER_FOLDER = '.claude/code-critter/characters'

const FRESH: Saved = { mood: 70, moodAt: 0, char: BUILT_IN, lang: 'auto', isMuted: false, isHidden: false, uses: {} }
const saved = atom({ plugin: 'code-critter', key: 'saved' } as const, FRESH)
const usage = atom({ plugin: 'code-critter', key: 'usage' } as const, { model: '' } as Usage)
const activity = atom({ plugin: 'code-critter', key: 'activity' } as const, { state: 'idle', seq: 0 } as Activity)
const view = atom({ plugin: 'code-critter', key: 'view' } as const, {
  names: [], problems: [], isConfirmingClear: false, isContextDismissed: false, isLimitDismissed: false, locale: 'en', now: 0,
} as View)

// Reloaded with the module; `load` fills it again.
const characters = new Map<string, Character>()
let isCreating = false
let ticking: { cancel: () => void } | undefined

const persist = async ($: EngineInterface) => $.store.set('pet', await read($, saved))
const change = async ($: EngineInterface, fn: (s: Saved) => Saved) => {
  await update($, saved, fn)
  await persist($)
}
const text = async ($: EngineInterface) => strings((await read($, view)).locale)

async function userFolder($: EngineInterface): Promise<string | undefined> {
  const home = (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE'))
  return home ? `${home}/${USER_FOLDER}` : undefined
}

// Reads every character folder: the mod's own, then the person's, which wins a
// shared name. A file that fails is reported and left out.
async function load($: EngineInterface) {
  const folders = [`${$.plugin.root}/characters`]
  const mine = await userFolder($)
  if (mine) folders.push(mine)
  const problems: string[] = []
  characters.clear()
  for (const folder of folders) {
    if (!(await $.fs.exists(folder))) continue
    for (const entry of await $.fs.list(folder)) {
      if (entry.kind !== 'dir') continue
      try {
        const checked = validateCharacter(JSON.parse(await $.fs.read(`${folder}/${entry.name}/character.json`)))
        if (checked.ok) characters.set(entry.name, checked.character)
        else problems.push(...checked.errors.slice(0, 5).map(error => `${entry.name}: ${error}`))
      } catch (error) {
        problems.push(`${entry.name}: ${error instanceof Error ? error.message : 'unreadable'}`)
      }
    }
  }
  const names = [...characters.keys()]
  await update($, view, v => ({ ...v, names, problems }))
  return { names, problems }
}

// Shows `state`, then goes back to idle after `forMs` unless something newer took over.
async function act($: EngineInterface, state: string, options: { bubble?: string; forMs?: number } = {}) {
  const now = await update($, activity, a => ({ state, bubble: options.bubble, seq: a.seq + 1 }))
  const wait = options.forMs ?? (state === 'idle' ? SLEEP_AFTER : undefined)
  if (wait === undefined) return
  $.clock.after(wait, async () => {
    if ((await read($, activity)).seq !== now.seq) return
    await act($, state === 'idle' ? 'sleep' : 'idle')
  })
}

async function measure($: EngineInterface, figures: { context: { percent?: number }; rateLimits: { kind: string; percentUsed: number; resetsAt?: string }[]; cost?: { usd: number } }) {
  const five = figures.rateLimits.find(limit => limit.kind === 'five_hour')
  const seven = figures.rateLimits.find(limit => limit.kind === 'seven_day')
  const next: Usage = {
    context: figures.context.percent,
    fiveHour: five?.percentUsed, fiveHourResets: five?.resetsAt,
    sevenDay: seven?.percentUsed, sevenDayResets: seven?.resetsAt,
    usd: figures.cost?.usd,
    model: await $.session.model(),
  }
  await update($, usage, () => next)
  // A nudge the person closed comes back only after the figure has dropped and risen again.
  const isLimitLow = Math.max(next.fiveHour ?? 0, next.sevenDay ?? 0) < LIMIT_HIGH
  await update($, view, v => ({
    ...v,
    isContextDismissed: v.isContextDismissed && (next.context ?? 0) >= CONTEXT_HIGH,
    isLimitDismissed: v.isLimitDismissed && !isLimitLow,
  }))
  const parts = [next.context === undefined ? '' : `ctx ${Math.round(next.context)}%`, next.fiveHour === undefined ? '' : `5h ${Math.round(next.fiveHour)}%`]
  $.ui.status(parts.some(Boolean) ? `🐒 ${parts.filter(Boolean).join(' · ')}` : undefined)
}

// Sends Claude a prompt as a turn of its own. A command's hook holds the turn
// a prompt would wait on, so the prompt goes out just after the hook returns.
function ask($: EngineInterface, prompt: string) {
  $.clock.after(1, () => { $.prompt.submit({ text: prompt }).catch(() => {}) })
}

// Runs a recommended command for the person: a template as a prompt, the rest as typed.
async function run($: EngineInterface, command: string) {
  const now = await $.clock.now()
  await change($, s => ({ ...s, uses: recordUse(s.uses, command, now) }))
  await act($, commandState(command), { bubble: `/${command}!`, forMs: 4000 })
  const t = await text($)
  if (command === 'explain') ask($, t.explain)
  else if (command === 'commit-msg') ask($, t.commitMsg)
  // A command that has since gone (a removed skill) is refused; the button then does nothing.
  else $.command.run({ command }).catch(() => {})
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const stored = (await $.store.get('pet')) as Partial<Saved> | undefined
    const now = await $.clock.now()
    const kept = await update($, saved, () => ({ ...FRESH, moodAt: now, ...stored }))
    const system = (await $.env.get('LC_ALL')) ?? (await $.env.get('LANG')) ?? undefined
    const locale = pickLocale(kept.lang, system)
    await update($, view, v => ({ ...v, locale, now }))
    await load($)
    const t = strings(locale)
    await $.command.register({ name: 'pet', description: t.petDescription, argumentHint: '[help|char|reload|create|lang|mute|reset]' })
    // Another plugin may already own one of these names: the pet works without them.
    await $.command.register({ name: 'explain', description: t.explainDescription }).catch(() => {})
    await $.command.register({ name: 'commit-msg', description: t.commitMsgDescription }).catch(() => {})
    // Mood and the reset countdowns move with time alone.
    ticking?.cancel()
    ticking = $.clock.every(60_000, async () => {
      const tick = await $.clock.now()
      await update($, view, v => ({ ...v, now: tick }))
    })
    try {
      await measure($, await $.session.usage())
    } catch {
      // No figures before the first turn on some hosts; session.measure brings them.
    }
    await act($, 'idle')
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await measure($, e)
    return next(e)
  })

  // Every slash command the person types is counted by name, and acted out.
  on('command.run', async ($, e, next) => {
    const isOwn = e.command === 'pet' || (e.origin.kind === 'plugin' && e.origin.name === 'code-critter')
    if (!isOwn) {
      const now = await $.clock.now()
      await change($, s => ({ ...s, uses: recordUse(s.uses, e.command, now) }))
      await act($, commandState(e.command), { bubble: `/${e.command}!`, forMs: 4000 })
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'explain' }, async $ => {
    ask($, (await text($)).explain)
    return { text: '/explain' }
  })

  on('command.run', { command: 'commit-msg' }, async $ => {
    ask($, (await text($)).commitMsg)
    return { text: '/commit-msg' }
  })

  on('command.run', { command: 'pet' }, async ($, e) => {
    const t = await text($)
    const [sub = '', ...rest] = e.args.trim().split(/\s+/)
    const arg = rest.join(' ')
    if (sub === 'help') return { text: t.help }
    if (sub === 'lang') {
      if (arg !== 'en' && arg !== 'zh-TW' && arg !== 'auto') return { text: t.langUsage }
      const lang: Lang = arg
      await change($, s => ({ ...s, lang }))
      const system = (await $.env.get('LC_ALL')) ?? (await $.env.get('LANG')) ?? undefined
      const locale = pickLocale(lang, system)
      await update($, view, v => ({ ...v, locale }))
      return { text: strings(locale).langSet(arg) }
    }
    if (sub === 'char') {
      if (!characters.has(arg)) return { text: t.charUnknown(arg, [...characters.keys()].join(', ')) }
      await change($, s => ({ ...s, char: arg }))
      return { text: t.charSet(arg) }
    }
    if (sub === 'reload') {
      const got = await load($)
      return { text: [t.loaded(got.names.length), ...got.problems].join('\n') }
    }
    if (sub === 'reset') {
      const now = await $.clock.now()
      await change($, s => ({ ...s, uses: {}, mood: FRESH.mood, moodAt: now }))
      return { text: t.reset }
    }
    if (sub === 'mute' || sub === 'unmute') {
      const isMuted = sub === 'mute' ? !(await read($, saved)).isMuted : false
      await change($, s => ({ ...s, isMuted }))
      return { text: isMuted ? t.muted : t.unmuted }
    }
    if (sub === 'create') {
      if (!arg) return { text: t.createUsage }
      const folder = await userFolder($)
      isCreating = true
      ask($, `Read ${$.plugin.root}/CHARACTER_PROMPT.md and follow it exactly to draw this character: ${arg}\n\nWrite the JSON to ${folder ?? `~/${USER_FOLDER}`}/<name>/character.json, where <name> is the character's "name". Re-count every row before writing. Reply with the name only.`)
      return { text: t.creating }
    }
    const isHidden = !(await read($, saved)).isHidden
    await change($, s => ({ ...s, isHidden }))
    return { text: isHidden ? t.hidden : t.shown }
  })

  on('prompt.submit', async ($, e, next) => {
    await act($, 'think')
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await act($, 'think')
    return next(e)
  })

  // Only Claude's own calls are acted out: a subagent's would flicker over them.
  on('tool.call', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    const mine = await update($, activity, a => ({ state: toolState(String(e.tool)), seq: a.seq + 1 }))
    const result = await next(e)
    if ((await read($, activity)).seq === mine.seq) await act($, 'think')
    return result
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    const now = await $.clock.now()
    await change($, s => ({ ...s, ...turnDone(s, now) }))
    await act($, 'happy', { forMs: 3000 })
    // The turn that ended may not be the one drawing: keep looking until a new character shows up.
    if (isCreating) {
      const before = characters.size
      const got = await load($)
      if (got.names.length > before || got.problems.length > 0) {
        isCreating = false
        $.ui.toast((await text($)).created(got.names.join(', ')))
      }
    }
    return next(e)
  })

  // The band above the prompt: the room as a strip, the controls in a row under it.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const s = await read($, saved)
    if (e.props.hasSurvey || s.isHidden) return next(e)
    const { Box, Text, Button, Select } = $.ui.resolve(e)
    const u = await read($, usage)
    const a = await read($, activity)
    const v = await read($, view)
    const t = strings(v.locale)
    const now = Math.max(v.now, s.moodAt)
    const mood = moodAt(s, now)
    const isContextHigh = (u.context ?? 0) >= CONTEXT_HIGH
    const highLimit = (u.fiveHour ?? 0) >= LIMIT_HIGH ? t.fiveHour : (u.sevenDay ?? 0) >= LIMIT_HIGH ? t.sevenDay : undefined
    const hasCompactNudge = isContextHigh && !v.isContextDismissed && !s.isMuted
    const hasLimitNudge = !hasCompactNudge && highLimit !== undefined && !v.isLimitDismissed && !s.isMuted
    const nudge = hasCompactNudge ? t.nudgeCompact
      : hasLimitNudge ? t.nudgeLimit(highLimit, Math.round(Math.max(u.fiveHour ?? 0, u.sevenDay ?? 0)))
      : undefined
    const bubble = s.isMuted ? undefined : a.bubble ?? nudge
    // At rest the pet shows how it is: worn out by a full context, bored when neglected.
    const state = a.state !== 'idle' ? a.state : isContextHigh ? 'tired' : level(mood) === 'bored' ? 'sad' : 'idle'
    const facts = [
      u.model,
      until(u.fiveHourResets, now, v.locale) && t.resetsIn(t.fiveHour, until(u.fiveHourResets, now, v.locale)),
      until(u.sevenDayResets, now, v.locale) && t.resetsIn(t.sevenDay, until(u.sevenDayResets, now, v.locale)),
      u.usd === undefined ? '' : `$${u.usd.toFixed(2)}`,
    ].filter(Boolean).join(' · ')
    const commands = recommend(s.uses, now, u.context)
    const character = characters.get(s.char) ?? characters.get(BUILT_IN)

    const controls = (
      <Box flexDirection="column">
        <Box gap={1} flexWrap="wrap">
          {hasCompactNudge && <Button key="nudge-run" variant="primary" onPress={() => run($, 'compact')}>{t.runCompact}</Button>}
          {nudge !== undefined && (
            <Button key="nudge-dismiss" onPress={async () => { await update($, view, w => (hasCompactNudge ? { ...w, isContextDismissed: true } : { ...w, isLimitDismissed: true })) }}>{t.dismiss}</Button>
          )}
          {commands.map(command => (
            <Button key={`run-${command}`} onPress={async () => {
              // /clear throws the conversation away, so it takes a second press.
              if (command === 'clear' && !(await read($, view)).isConfirmingClear) { await update($, view, w => ({ ...w, isConfirmingClear: true })); return }
              await update($, view, w => ({ ...w, isConfirmingClear: false }))
              await run($, command)
            }}>{command === 'clear' && v.isConfirmingClear ? t.reallyClear : `/${command}`}</Button>
          ))}
          {v.names.length > 1 && (
            <Select key="char" label={t.character} options={v.names.map(value => ({ value }))} value={characters.has(s.char) ? s.char : BUILT_IN} onSelect={async value => { await change($, p => ({ ...p, char: value })) }} />
          )}
          {facts !== '' && <Text dimColor>{facts}</Text>}
        </Box>
        {e.surface === 'terminal' && nudge !== undefined && <Text>{nudge}</Text>}
        {v.problems.map(problem => <Text color="error">{problem}</Text>)}
      </Box>
    )
    if (e.surface === 'terminal' || character === undefined) return controls
    const { Svg } = $.ui.resolve(e)
    const source = scene({ character, state, bubble, hearts: level(mood) === 'happy', context: u.context, fiveHour: u.fiveHour, sevenDay: u.sevenDay })
    return (
      <Box flexDirection="column">
        <Svg source={source} alt={t.alt(character.name, state)} isInteractive />
        {controls}
      </Box>
    )
  })
}
