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

describe('single Copper row', () => {
  const reset = (list: unknown[], active = '') => {
    store.set('m-accounts', JSON.stringify(list))
    store.set('m-active', active)
    useAccounts.setState({ list: list as never, active })
  }

  test('second sign-in replaces the first', () => {
    reset([{ id: 'a1', nick: 'durov', kind: 'copper', balance: 5000 }], 'a1')
    const acc = useAccounts.getState().add({ nick: 'steve', kind: 'copper' })
    const list = useAccounts.getState().list
    expect(list.length, 'the launcher holds one Copper session, so a second row would show it twice').toBe(1)
    expect(list[0].nick, 'the row names whoever is signed in now').toBe('steve')
    expect(list[0].balance, "the previous user's balance must not follow the new login").toBeUndefined()
    expect(acc.id, 'the row keeps its id so the active account stays addressable').toBe('a1')
  })

  test('a tg row is the same slot as a copper row', () => {
    reset([{ id: 'a1', nick: 'durov', kind: 'tg' }], 'a1')
    useAccounts.getState().add({ nick: 'durov', kind: 'copper' })
    expect(useAccounts.getState().list.length, 'tg is the old name of the same Copper login').toBe(1)
  })

  test('a Microsoft row survives a Copper sign-in', () => {
    reset([{ id: 'm1', nick: 'qwseMC', kind: 'microsoft' }], 'm1')
    useAccounts.getState().add({ nick: 'durov', kind: 'copper' })
    const kinds = useAccounts.getState().list.map((a) => a.kind)
    expect(kinds, 'licence accounts carry their own tokens and are unrelated to the site session').toEqual(['microsoft', 'copper'])
  })

  test('duplicates written by older builds collapse on load', async () => {
    store.set(
      'm-accounts',
      JSON.stringify([
        { id: 'm1', nick: 'qwseMC', kind: 'microsoft' },
        { id: 'a1', nick: 'durov', kind: 'copper' },
        { id: 'a2', nick: 'durov', kind: 'copper' },
      ]),
    )
    store.set('m-active', 'a2')
    const { loadState } = await import('./accounts')
    const state = loadState()
    expect(state.list.map((a) => a.id), 'both rows point at the one live session; the active one is the truthful row').toEqual(['m1', 'a2'])
    expect(state.active, 'the surviving row stays active').toBe('a2')
  })
})
