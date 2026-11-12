import { expect, test } from 'claude-code/testing'
import { pickLocale, strings, until } from '../hooks/i18n'

test('the locale is the choice, else the system, else Chinese where the system says nothing', async () => {
  expect(pickLocale('en', 'zh_TW.UTF-8')).toBe('en')
  expect(pickLocale('auto', 'zh_TW.UTF-8')).toBe('zh-TW')
  expect(pickLocale('auto', 'en_US.UTF-8')).toBe('en')
  expect(pickLocale('auto', undefined)).toBe('zh-TW')
})

test('both locales have every string', async () => {
  expect(Object.keys(strings('zh-TW')).sort()).toEqual(Object.keys(strings('en')).sort())
})

test('time until a reset', async () => {
  const now = Date.parse('2026-01-01T00:00:00Z')
  expect(until('2026-01-01T02:05:00Z', now, 'en')).toBe('2h 5m')
  expect(until('2026-01-01T00:20:00Z', now, 'en')).toBe('20m')
  expect(until('2026-01-05T00:00:00Z', now, 'zh-TW')).toBe('4 天')
  expect(until('2025-12-31T00:00:00Z', now, 'en')).toBe('')
  expect(until(undefined, now, 'en')).toBe('')
  expect(until('nonsense', now, 'en')).toBe('')
})
