import { expect, test } from 'claude-code/testing'
import { DEFAULTS, HALF_LIFE, recommend, recordUse } from '../hooks/rank'
import { commandState, toolState } from '../hooks/mimic'

test('with no history the defaults show', async () => {
  expect(recommend({}, 0)).toEqual(DEFAULTS)
})

test('used commands lead, most used first, defaults fill the rest', async () => {
  let uses = recordUse({}, 'deploy', 0)
  uses = recordUse(uses, 'model', 0)
  uses = recordUse(uses, 'model', 0)
  expect(recommend(uses, 0)).toEqual(['model', 'deploy', 'compact', 'clear', 'context', 'review'])
})

test('recent use outweighs old use: a score halves every 30 days', async () => {
  let uses = recordUse({}, 'old', 0)
  uses = recordUse(uses, 'old', 0)
  uses = recordUse(uses, 'old', 0)
  uses = recordUse(uses, 'new', 2 * HALF_LIFE)
  expect(recommend(uses, 2 * HALF_LIFE).slice(0, 2)).toEqual(['new', 'old'])
  expect(recordUse(uses, 'old', 2 * HALF_LIFE)['old']?.score).toBe(1.75)
})

test('/compact leads while the context is at 80% or more', async () => {
  const uses = recordUse({}, 'deploy', 0)
  expect(recommend(uses, 0, 79)[0]).toBe('deploy')
  expect(recommend(uses, 0, 80)[0]).toBe('compact')
  expect(recommend(uses, 0, 80)).toHaveLength(6)
})

test('tools and commands map to what the pet acts out', async () => {
  expect([toolState('Read'), toolState('Edit'), toolState('Bash'), toolState('WebSearch'), toolState('Agent'), toolState('mcp__x__y')])
    .toEqual(['read', 'write', 'type', 'search', 'clone', 'work'])
  expect([commandState('compact'), commandState('clear'), commandState('model'), commandState('anything')])
    .toEqual(['squash', 'wipe', 'hat', 'copy'])
})
