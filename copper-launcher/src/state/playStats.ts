import { create } from 'zustand'
import { getPlayStats, labelServer } from '../ipc/commands'
import type { PlayStats } from '../ipc/commands'
import { hasTauri } from '../ipc/tauri'
import { canonAddr } from '../lib/serverAddr'
import { DEMO_USER } from '../lib/demo'

const EMPTY: PlayStats = {
  total_seconds: 0,
  sessions: 0,
  builds: [],
  servers: [],
  last_build: '',
  last_server: '',
  last_server_name: '',
  last_at: 0,
}

export const statsShared = (): boolean => false

interface State {
  stats: PlayStats
  /** Секунды, которые подтвердил сервер; null — ещё не спрашивали. */
  verifiedSeconds: number | null
  loaded: boolean
  /** 'due' re-reads the local counter but sends the snapshot only when the in-game period has passed. */
  refresh: (sync?: 'always' | 'due') => Promise<void>
}

export const usePlayStats = create<State>((set) => ({
  stats: EMPTY,
  verifiedSeconds: null,
  loaded: false,
  refresh: async (_sync = 'always') => {
    if (!hasTauri()) {
      // &day0 в демо — первый день без запусков (экран новичка, сундук первого часа).
      set({ stats: import.meta.env.DEV && DEMO_USER && !location.search.includes('day0') ? demoStats() : EMPTY, loaded: true })
      return
    }
    try {
      const stats = await getPlayStats()
      set({ stats, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },
}))

/** Демо-вход (только dev): `&play-hours=47` — сколько наиграно; без параметра — первый день. */
function demoStats(): PlayStats {
  const h = Number(new URLSearchParams(location.search).get('play-hours')) || 0
  return h > 0 ? { ...EMPTY, total_seconds: Math.round(h * 3600), sessions: 12 } : EMPTY
}

export const refreshPlayStats = () => usePlayStats.getState().refresh()

/**
 * Пока игра идёт, счёт часов перечитывается сам.
 *
 * Ядро сбрасывает наигранное на диск раз в минуту, а интерфейс до сих пор
 * спрашивал его только при ВЫХОДЕ из игры. Снаружи это выглядело как «время не
 * записывается»: сборка запущена, час идёт, а под карточкой пусто - и первым,
 * что человек видел, был ноль у той сборки, в которую он прямо сейчас играет.
 *
 * Тот же период, что у сброса на диск: чаще спрашивать нечего, реже - и
 * показанное число отстаёт сильнее, чем длится сессия у большинства.
 */
const WHILE_PLAYING = 60_000
let ticking: ReturnType<typeof setInterval> | null = null

export function watchPlaytimeWhileRunning(running: () => boolean): void {
  if (ticking) return
  ticking = setInterval(() => {
    if (!running()) return
    void usePlayStats.getState().refresh('due')
  }, WHILE_PLAYING)
}

/**
 * Локальный счётчик и подтверждённое время считаются по-разному: второе растёт
 * только пока сервер видит удары. Показываем оба, иначе разница читается как
 * потерянные часы.
 */
export const setVerifiedSeconds = (seconds: number | null) => {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return
  usePlayStats.setState({ verifiedSeconds: Math.round(seconds) })
}

export const buildStat = (build: string) =>
  usePlayStats.getState().stats.builds.find((b) => b.key === build) || null

export { canonAddr }

/** Имя сервера для адреса: сначала то, что уже знает ядро, затем рейтинг. */
export function serverNameFor(addr: string): string {
  const key = canonAddr(addr)
  if (!key) return ''
  const known = usePlayStats.getState().stats.servers.find((s) => canonAddr(s.key) === key)
  return (known && known.label) || ''
}

export function rememberServerName(addr: string, name: string) {
  if (!addr || !name || !hasTauri()) return
  void labelServer(addr, name).catch(() => {})
}

