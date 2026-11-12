// What the pet keeps across sessions, in the mod's store.
export type Saved = {
  mood: number
  moodAt: number
  char: string
  lang: 'auto' | 'en' | 'zh-TW'
  isMuted: boolean
  isHidden: boolean
  uses: Record<string, { score: number; at: number }>
}

export type Usage = {
  context?: number
  fiveHour?: number
  fiveHourResets?: string
  sevenDay?: number
  sevenDayResets?: string
  usd?: number
  model: string
}

// What the pet is acting out now; `seq` tells a later timer whether it is still current.
export type Activity = { state: string; bubble?: string; seq: number }

export type View = {
  names: string[]
  problems: string[]
  isConfirmingClear: boolean
  isContextDismissed: boolean
  isLimitDismissed: boolean
  locale: 'en' | 'zh-TW'
  now: number
}

declare module 'claude-code' {
  interface PluginState {
    'code-critter': { saved: Saved; usage: Usage; activity: Activity; view: View }
  }
}
