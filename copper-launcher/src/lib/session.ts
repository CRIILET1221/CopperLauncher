import { api, hasCopperAccount } from './api'
import { COPPER_USER_KEY, useAccounts } from '../state/accounts'
import { syncAuth } from '../state/auth'
import { loadFriends } from '../state/friends'
import { loadRooms } from '../state/rooms'
import { refreshPlayStats } from '../state/playStats'
import { refreshProfiles } from '../state/profiles'
import { refreshGameNick } from '../state/gameNick'
import { useUi } from '../state/ui'
import { hasTauri } from '../ipc/tauri'
import { copperLogout } from '../ipc/commands'
import { refreshSessionState } from './secure'
import { playSound } from './sound'
import { noteAppRun } from '../state/navHint'
import { loadPrivacy, usePrivacy } from './privacy'

export interface CopperProfile {
  nickname?: string
  avatarUrl?: string
}

export let COPPER_PROFILE: CopperProfile | null = null

/**
 * The wallet is topped up on the site, outside the launcher, so the cached
 * balance goes stale. Returns the fresh available amount, or null when the
 * wallet could not be read and the cached value must not be trusted.
 */
export async function refreshCopperWallet(): Promise<number | null> {
  if (!hasCopperAccount()) return null
  const wallet = await api<{ availableKopecks?: number }>('/core/wallet/me/display').catch(() => null)
  const kopecks = wallet?.availableKopecks
  if (typeof kopecks !== 'number') return null
  const { list, save } = useAccounts.getState()
  const i = list.findIndex((x) => x.kind === 'copper' || x.kind === 'tg')
  if (i < 0) return null
  const l = list.slice()
  l[i] = { ...l[i], balance: kopecks }
  save(l)
  return kopecks
}

export async function loadCopperProfile(): Promise<CopperProfile | null> {
  if (!hasCopperAccount()) return null
  try {
    const [me] = await Promise.all([api<CopperProfile>('/users/me'), refreshCopperWallet()])
    COPPER_PROFILE = me
    const { list, save } = useAccounts.getState()
    const i = list.findIndex((x) => x.kind === 'copper' || x.kind === 'tg')
    if (i >= 0 && me.nickname) {
      const l = list.slice()
      l[i] = { ...l[i], nick: me.nickname }
      save(l)
    }
    return me
  } catch {
    return null
  }
}

export function enterApp() {
  playSound('login')
  useUi.getState().setLogged(true)
  syncAuth()
  void refreshProfiles()
  void loadCopperProfile()
  void loadFriends()
  void loadRooms()
  void refreshPlayStats()
  void refreshGameNick()

  noteAppRun()
  // Приватность живёт на сервере и общая с сайтом: тянем её сразу после входа,
  // чтобы настройка пережила переустановку лаунчера и правку на copper.net.
  void loadPrivacy(true)
}

function dropCopperSession() {
  COPPER_PROFILE = null
  localStorage.removeItem(COPPER_USER_KEY)
  // Приватность привязана к аккаунту: следующий вход не должен видеть чужие
  // тумблеры до ответа сервера.
  usePrivacy.setState({ loaded: false, error: '', saving: null })
  if (!hasTauri()) return
  void copperLogout()
    .catch(() => {})
    .then(() => refreshSessionState())
}

export function forgetCopperIfGone() {
  const has = useAccounts.getState().list.some((a) => a.kind === 'copper' || a.kind === 'tg')
  if (has) return
  dropCopperSession()
}

export function logoutToLogin() {
  dropCopperSession()
  // Убираем сам аккаунт Copper/TG из списка: иначе при следующем запуске
  // getAccount() снова true → enterApp() поднимает залогиненную оболочку без
  // токена (кошелёк/друзья/хостинг молча мертвы, вернуться на вход нельзя).
  // Microsoft/офлайн-аккаунты не трогаем — у них свои токены.
  const acc = useAccounts.getState()
  acc.list
    .filter((a) => a.kind === 'copper' || a.kind === 'tg')
    .forEach((a) => acc.remove(a.id))
  useUi.getState().setLogged(true)
  syncAuth()
  void refreshGameNick()
}
