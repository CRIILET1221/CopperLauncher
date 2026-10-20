import { describe, expect, test } from 'bun:test'

const store = new Map<string, string>()

Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  },
  configurable: true,
})

const { useAccounts, loadState } = await import('./accounts')

describe('retired offline accounts', () => {
  test('migration removes old offline rows and selects a remaining account', () => {
    store.set('m-accounts', JSON.stringify([
      { id: 'old', nick: 'Steve', kind: 'offline' },
      { id: 'licensed', nick: 'Alex', kind: 'microsoft' },
    ]))
    store.set('m-active', 'old')
    store.set('copper-local-skins-v1', 'saved skins')
    const state = loadState()
    expect(state.list.map((a) => a.id)).toEqual(['licensed'])
    expect(state.active).toBe('licensed')
    expect(JSON.parse(store.get('m-accounts')!)).toHaveLength(1)
    expect(store.get('copper-local-skins-v1')).toBe('saved skins')
  })

  test('migration of an offline-only list leaves no active account', () => {
    store.set('m-accounts', JSON.stringify([{ id: 'old', nick: 'Steve', kind: 'offline' }]))
    store.set('m-active', 'old')
    expect(loadState()).toEqual({ list: [], active: '' })
  })

  test('an offline account cannot be added programmatically', () => {
    expect(() => useAccounts.getState().add({ nick: 'Steve', kind: 'offline' })).toThrow()
  })
})

describe('retired Copper accounts', () => {
  test('copper and tg rows from older builds are dropped on load', () => {
    store.set(
      'm-accounts',
      JSON.stringify([
        { id: 'm1', nick: 'qwseMC', kind: 'microsoft' },
        { id: 'a1', nick: 'durov', kind: 'copper' },
        { id: 'a2', nick: 'durov', kind: 'tg' },
      ]),
    )
    store.set('m-active', 'a2')
    const state = loadState()
    expect(state.list.map((a) => a.id), 'the Copper login was removed with its server').toEqual(['m1'])
    expect(state.active, 'the remaining account becomes active').toBe('m1')
  })
})
