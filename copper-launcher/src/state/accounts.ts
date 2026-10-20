import { create } from 'zustand'
import { hasTauri } from '../ipc/tauri'
import { msSessionForget } from '../ipc/commands'
import { hasAccountSession, refreshSessionState } from '../lib/secure'

export interface Account {
  id: string
  nick: string
  kind: string
  uuid?: string
  xuid?: string
  avatar?: string
  /// Из какого скина нарисовано лицо: по нему видно, что оно устарело.
  avatarFrom?: string
  exp?: number
}

type AccountInput = Partial<Account> & { nick: string; kind: string }

/// Faces drawn before 05.10.2026 came off a GPU canvas, which after a GPU crash
/// returns white pixels; only faces carrying this mark were drawn on the CPU.
export const HEAD_FROM_CPU = 'cpu:'

const isHeadAvatar = (v?: string, from?: string): boolean =>
  !!v && v.startsWith('data:image/') && !!from && from.startsWith(HEAD_FROM_CPU)

/// Kinds the launcher no longer signs in with: offline nicks and the removed Copper/Telegram login.
const RETIRED_KINDS = new Set(['offline', 'copper', 'tg'])

function readAccounts(): Account[] {
  try {
    const list = JSON.parse(localStorage.getItem('m-accounts') || 'null') || []
    return Array.isArray(list)
      ? list.map((a: Account & { token?: string }) => {
          const { token: _drop, avatar, avatarFrom, ...rest } = a
          return (isHeadAvatar(avatar, avatarFrom) ? { ...rest, avatar, avatarFrom } : rest) as Account
        })
      : []
  } catch {
    return []
  }
}

function persist(list: Account[]) {
  const clean = list.map((a) => (isHeadAvatar(a.avatar, a.avatarFrom) ? a : { ...a, avatar: undefined, avatarFrom: undefined }))
  localStorage.setItem('m-accounts', JSON.stringify(clean))
}

function readActive(): string {
  return localStorage.getItem('m-active') || ''
}

export function loadState(): { list: Account[]; active: string } {
  const stored = readAccounts().filter((a) => !RETIRED_KINDS.has(a.kind))
  const selected = readActive()
  const active = stored.some((a) => a.id === selected) ? selected : stored[0]?.id || ''
  const state = { list: stored, active }
  if (state.list.length !== readAccounts().length || state.active !== readActive()) {
    persist(state.list)
    localStorage.setItem('m-active', state.active)
  }
  return state
}

interface AccountsState {
  list: Account[]
  active: string
  setActive: (id: string) => void
  add: (a: AccountInput) => Account
  remove: (id: string) => void
  save: (list: Account[]) => void
}

const initial = loadState()

export const useAccounts = create<AccountsState>((set, get) => ({
  list: initial.list,
  active: initial.active,
  setActive: (id) => {
    localStorage.setItem('m-active', id)
    set({ active: id })
  },
  add: (input) => {
    if (input.kind === 'offline') throw new Error('Офлайн-аккаунты больше не поддерживаются')
    const l = get().list.slice()
    const acc: Account = { ...(input as Account) }
    acc.id = acc.id || 'acc' + Date.now() + Math.floor(Math.random() * 1000)
    const i = l.findIndex((x) => x.nick === acc.nick && x.kind === acc.kind)
    if (i >= 0) {
      Object.assign(l[i], acc)
      acc.id = l[i].id
    } else {
      l.push(acc)
    }
    persist(l)
    localStorage.setItem('m-active', acc.id)
    set({ list: l, active: acc.id })
    return acc
  },
  remove: (id) => {
    const l = get().list.filter((a) => a.id !== id)
    if (hasTauri())
      void msSessionForget(id)
        .catch(() => {})
        .then(() => refreshSessionState())
    persist(l)
    let active = get().active
    if (active === id) {
      active = (l[0] && l[0].id) || ''
      localStorage.setItem('m-active', active)
    }
    set({ list: l, active })
  },
  save: (list) => {
    list = list.filter((a) => !RETIRED_KINDS.has(a.kind))
    persist(list)
    set({ list: list.slice() })
  },
}))

export function getAccount(): Account | null {
  const { list, active } = useAccounts.getState()
  if (!list.length) return null
  return list.find((a) => a.id === active) || list[0]
}

export function hasLicenseSession(a: Account): boolean {
  return hasAccountSession(a.id)
}

// Refresh ahead of real expiry: a token this close to the edge dies mid-launch.
const MS_TOKEN_SKEW_MS = 5 * 60 * 1000

export function msTokenFresh(a: Account): boolean {
  return hasAccountSession(a.id) && !!a.exp && a.exp - Date.now() > MS_TOKEN_SKEW_MS
}

export function msTokenExpired(a: Account): boolean {
  return hasAccountSession(a.id) && !!a.exp && a.exp - Date.now() <= MS_TOKEN_SKEW_MS
}

localStorage.removeItem('m-nick-override')

if (!useAccounts.getState().list.length) {
  try {
    const old = JSON.parse(localStorage.getItem('m-account') || 'null')
    if (old && old.nick) useAccounts.getState().add(old)
  } catch {}
}
