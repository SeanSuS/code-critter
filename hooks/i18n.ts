// Every string the pet shows, in English and Traditional Chinese.
export type Locale = 'en' | 'zh-TW'
export type Lang = Locale | 'auto'

const EN = {
  character: 'Character',
  nudgeCompact: 'Context is nearly full. Compact it?',
  runCompact: '▶ Run /compact',
  nudgeLimit: (label: string, percent: number) => `${label} limit is at ${percent}%. Take a break?`,
  fiveHour: '5-hour',
  sevenDay: '7-day',
  dismiss: '✕',
  collapse: '▾ Collapse',
  expand: '▸ Expand',
  reallyClear: 'Really clear?',
  resetsIn: (label: string, time: string) => `${label} resets in ${time}`,
  days: 'd', hours: 'h', minutes: 'm',
  shown: 'Pet shown.',
  hidden: 'Pet hidden.',
  langSet: (lang: string) => `Language: ${lang}.`,
  langUsage: 'Usage: /pet lang en | zh-TW | auto',
  charSet: (name: string) => `Character: ${name}.`,
  charUnknown: (name: string, names: string) => `No character named "${name}". Loaded: ${names}.`,
  loaded: (n: number) => `${n} character${n === 1 ? '' : 's'} loaded.`,
  reset: 'Usage history and mood were reset.',
  muted: 'Speech bubbles are off.',
  unmuted: 'Speech bubbles are on.',
  creating: 'Asked Claude to draw it. It loads when the turn ends.',
  createUsage: 'Usage: /pet create <describe your character>',
  created: (names: string) => `Characters loaded: ${names}.`,
  help: '/pet — show or hide · /pet char <name> · /pet reload · /pet create <description> · /pet lang en|zh-TW|auto · /pet mute · /pet reset',
  explain: 'Explain the code I am working on: what it does, how it fits together, and anything surprising in it.',
  commitMsg: 'Write a commit message for the staged changes (or for all current changes if nothing is staged). Give me the message only; do not commit.',
  explainDescription: 'Explain the code being worked on',
  commitMsgDescription: 'Draft a commit message for the current changes',
  petDescription: 'Show or hide the pet; /pet help lists the rest',
  alt: (name: string, state: string) => `${name} the desk pet: ${state}`,
}

const ZH: typeof EN = {
  character: '角色',
  nudgeCompact: 'context 快滿了，要壓縮一下嗎？',
  runCompact: '▶ 執行 /compact',
  nudgeLimit: (label, percent) => `${label}額度用了 ${percent}%，休息一下吧。`,
  fiveHour: '5 小時',
  sevenDay: '7 天',
  dismiss: '✕',
  collapse: '▾ 收合',
  expand: '▸ 展開',
  reallyClear: '確定清空？',
  resetsIn: (label, time) => `${label}額度 ${time}後重置`,
  days: ' 天', hours: ' 小時', minutes: ' 分',
  shown: '寵物出來了。',
  hidden: '寵物躲起來了。',
  langSet: lang => `語言：${lang}。`,
  langUsage: '用法：/pet lang en | zh-TW | auto',
  charSet: name => `角色：${name}。`,
  charUnknown: (name, names) => `找不到角色「${name}」。已載入：${names}。`,
  loaded: n => `已載入 ${n} 隻角色。`,
  reset: '使用紀錄和心情已重設。',
  muted: '對話泡泡已關閉。',
  unmuted: '對話泡泡已開啟。',
  creating: '已請 Claude 畫角色，這一輪結束後會自動載入。',
  createUsage: '用法：/pet create <描述你的角色>',
  created: names => `已載入角色：${names}。`,
  help: '/pet：顯示或隱藏 · /pet char <名字> · /pet reload · /pet create <描述> · /pet lang en|zh-TW|auto · /pet mute · /pet reset',
  explain: '請解釋我正在處理的程式碼：它做什麼、各部分怎麼組合，以及有哪些出乎意料的地方。',
  commitMsg: '請為已 staged 的改動寫一則 commit 訊息（沒有 staged 的話就用目前所有改動）。只給我訊息，不要執行 commit。',
  explainDescription: '解釋正在處理的程式碼',
  commitMsgDescription: '為目前的改動草擬 commit 訊息',
  petDescription: '顯示或隱藏寵物；/pet help 列出其他用法',
  alt: (name, state) => `桌面寵物 ${name}：${state}`,
}

export const strings = (locale: Locale) => (locale === 'zh-TW' ? ZH : EN)

// The locale to use: the person's choice, else the system's. An app started
// from the desktop often reports no locale at all: then Traditional Chinese,
// the language the pet was first written in.
export function pickLocale(lang: Lang, system: string | undefined): Locale {
  if (lang !== 'auto') return lang
  return system === undefined || /^zh/i.test(system) ? 'zh-TW' : 'en'
}

// "2h 5m" until an ISO time; empty once it has passed or cannot be read.
export function until(iso: string | undefined, now: number, locale: Locale): string {
  const t = strings(locale)
  const left = iso === undefined ? NaN : Date.parse(iso) - now
  if (!(left > 0)) return ''
  const minutes = Math.ceil(left / 60_000)
  if (minutes >= 48 * 60) return `${Math.round(minutes / 1440)}${t.days}`
  if (minutes >= 60) return `${Math.floor(minutes / 60)}${t.hours} ${minutes % 60}${t.minutes}`
  return `${minutes}${t.minutes}`
}
