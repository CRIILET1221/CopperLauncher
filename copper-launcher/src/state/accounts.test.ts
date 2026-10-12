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

const { launchAuthKind, useAccounts } = await import('./accounts')

const acc = (kind: string) => ({ id: 'a1', nick: 'Steve', kind })

describe('launchAuthKind', () => {
  const cases: Array<{ name: string; account: ReturnType<typeof acc> | null; copper: boolean; expect: string; why: string }> = [
    {
      name: 'offline account while signed into Copper',
      account: acc('offline'),
      copper: true,
      expect: 'offline',
      why: 'a Copper session overrides the launch nick with the site profile name, so the chosen offline nick never reaches the game',
    },
    { name: 'offline account without Copper', account: acc('offline'), copper: false, expect: 'offline', why: 'nothing else to use' },
    { name: 'copper account', account: acc('copper'), copper: true, expect: 'copper', why: 'our Yggdrasil session is what the account is for' },
    { name: 'telegram account', account: acc('tg'), copper: true, expect: 'copper', why: 'tg is a Copper login, not a separate nick' },
    {
      name: 'copper account without a session',
      account: acc('copper'),
      copper: false,
      expect: 'offline',
      why: 'no token to issue a session with',
    },
    { name: 'microsoft account', account: acc('microsoft'), copper: true, expect: 'microsoft', why: 'the licence wins over our session' },
    {
      name: 'ely.by account while signed into Copper',
      account: acc('elyby'),
      copper: true,
      expect: 'elyby',
      why: 'the chosen Ely.by account must reach the game; falling to offline drops its session and its skin',
    },
    { name: 'no account at all', account: null, copper: true, expect: 'copper', why: 'nothing chose a nick, so the session may name one' },
  ]

  for (const c of cases)
    test(c.name, () => {
      expect(launchAuthKind(c.account, c.copper), c.why).toBe(c.expect as never)
    })
})

describe('launchAuthKind on a Copper-only server', () => {
  const cases: Array<{ name: string; account: ReturnType<typeof acc> | null; copper: boolean; expect: string; why: string }> = [
    {
      name: 'microsoft account',
      account: acc('microsoft'),
      copper: true,
      expect: 'copper',
      why: 'OneBlock checks hasJoined on our Yggdrasil: a licence session is never found there and the player is kicked',
    },
    {
      name: 'offline account',
      account: acc('offline'),
      copper: true,
      expect: 'copper',
      why: 'an offline nick has no session at all, the gate turns it away too',
    },
    { name: 'copper account', account: acc('copper'), copper: true, expect: 'copper', why: 'already the right session' },
    {
      name: 'ely.by account',
      account: acc('elyby'),
      copper: true,
      expect: 'copper',
      why: 'OneBlock checks hasJoined on our Yggdrasil only, an Ely.by session is never found there',
    },
    {
      name: 'microsoft account without a Copper session',
      account: acc('microsoft'),
      copper: false,
      expect: 'offline',
      why: 'not copper, so the launch stops and asks to sign in instead of starting a game that cannot join',
    },
  ]

  for (const c of cases)
    test(c.name, () => {
      expect(launchAuthKind(c.account, c.copper, true), c.why).toBe(c.expect as never)
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
