import { hasTauri } from '../ipc/tauri'
import { cancelLaunch, launchGame, launchProfile, quickPlay, pinServerDat, runningGames, discordPresence as ipcDiscordPresence } from '../ipc/commands'
import { listenLaunchProgress } from '../ipc/events'
import type { UnlistenFn } from '../ipc/tauri'
import type { LaunchAuth } from '../ipc/commands'
import { getAccount } from '../state/accounts'
import { ensureMsAuth, startMsLogin } from '../state/msLogin'
import { uiConfirm } from '../state/confirm'
import { useProfiles } from '../state/profiles'
import { showToast, useUi } from '../state/ui'
import { useGame } from '../state/game'
import { applyLaunchWindowMode } from './window'
export { PL_STAGES, REPAIR_STAGES } from './launchView'

const STAGE_IDX: Record<string, number> = { files: 0, assets: 2, java: 1, launch: 3, mod: 0, content: 3 }

let session: { profile: string; server: string | null; serverName: string | null } | null = null
let sessionAt = 0

export const gameSession = () => session

export function setGameSession(profile: string | null, server?: string | null, serverName?: string | null) {
  session = profile ? { profile, server: server || null, serverName: serverName || null } : null
  sessionAt = profile ? Date.now() : 0
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(profile ? 'mc-started' : 'mc-stopped'))
}

/**
 * Куда игрок ушёл уже внутри игры: адрес приезжает из лога ядра, а не из
 * кнопки в лаунчере. Сессию правим на месте — «игра началась» второй раз не
 * случилось, поэтому событие mc-started здесь не шлётся.
 */
export function updateSessionServer(server: string | null, serverName: string | null) {
  if (!session) return
  if (session.server === server && session.serverName === serverName) return
  session = { ...session, server, serverName }
  heartbeat('playing')
}

/** Процесс успевает появиться в списке ядра не мгновенно — до этого верим сессии. */
const SESSION_GRACE_MS = 3 * 60 * 1000

/**
 * Сверка «в игре» с ядром: список процессов ведёт Rust, а не флаг во вьюхе.
 * Потерянное событие выхода раньше оставляло сессию навсегда — лаунчер в трее
 * продолжал бить «playing» и копить часы без запущенной игры.
 */
export async function reconcileGameSession(): Promise<void> {
  if (!session || launching) return
  // No core, no proof: a session that cannot be checked is dropped instead of
  // beating "playing" until the daily cap on the server side.
  if (!hasTauri()) {
    setGameSession(null)
    heartbeat('lobby')
    return
  }
  if (Date.now() - sessionAt < SESSION_GRACE_MS) return
  try {
    const list = (await runningGames()) || []
    useGame.getState().setList(list)
    if (!list.length) {
      setGameSession(null)
      heartbeat('lobby')
    }
  } catch {}
}

export const discordEnabled = () => localStorage.getItem('m-discord') !== '0'

/**
 * Показывается ли прямо сейчас активность Copper в Discord и на каком
 * аккаунте. Опыт за часы платится только за это время, поэтому сервер узнаёт
 * id из ответа ядра (READY-кадр сокета), а не со слов вьюхи.
 */
export function discordPresence(status?: string, server?: string | null): Promise<string> {
  if (!hasTauri() || !discordEnabled()) return Promise.resolve('')
  const playing = status === 'playing'
  const nick = (getAccount() || { nick: '' }).nick || ''
  const build = session ? session.profile : ''
  const pack = build ? useProfiles.getState().profiles.find((p) => p.name === build) : undefined
  // Discord only proxies https images; data: and local paths are silently ignored.
  const icon = pack && pack.icon && pack.icon.startsWith('https://') ? pack.icon : ''
  const details = playing ? (build ? 'Играет · ' + build : 'В игре') : 'В лаунчере'
  const place = (session && (session.serverName || session.server)) || server || ''
  const state = playing && place ? 'Сервер: ' + place : nick ? 'Ник: ' + nick : 'Copper Launcher'
  return ipcDiscordPresence(details, state, playing, icon, build)
    .then((st) => (st && st.userId) || '')
    .catch(() => '')
}

export function heartbeat(status?: string, server?: string | null) {
  void discordPresence(status, server)
}


export function ramMbFor(profile: string): number {
  const gb = parseInt(localStorage.getItem('m-ram-' + profile) || '0', 10)
  return gb > 0 ? gb * 1024 : 0
}

/// Minecraft launches require a verified Microsoft game session.
async function resolveAuth(_profile: string | null): Promise<{ nick: string; auth: LaunchAuth }> {
  const acc = getAccount()
  if (!acc || acc.kind !== 'microsoft') {
    throw new Error('Для запуска Minecraft добавь и выбери аккаунт Microsoft с приобретённой Java Edition')
  }
  const ms = await ensureMsAuth(acc)
  if (!ms) {
    void startMsLogin()
    throw new Error('Сессия Microsoft не подтверждена — войди заново и повтори запуск')
  }
  return { nick: acc.nick, auth: { kind: 'microsoft', accountId: ms.id, uuid: ms.uuid, xuid: ms.xuid } }
}

export function showLaunchError(e: unknown) {
  const msg = String(e && (e as Error).message ? (e as Error).message : e).replace(/^Error:\s*/, '')
  // A launch the user called off is not a failure and must not raise a red toast.
  if (/^Запуск отменён/.test(msg)) return
  showToast(/лиценз/i.test(msg) ? msg : 'Ошибка запуска: ' + msg, 'error')
}

let launching = false
/// Растёт при каждом «Отменить»: запуск, который ещё ждал входа, по нему видит отмену и не зовёт ядро.
let cancelEpoch = 0
const CANCELLED_TEXT = 'Запуск отменён'

/// doJoin resolves with the core's answer; this sentinel means the game was
/// never started, so callers must not report "заходим на сервер".
export const JOIN_SKIPPED = 'launch-skipped'

export const joinStarted = (res: unknown) => res !== JOIN_SKIPPED

const RELAUNCH_SAME_KEY = 'relaunch-same-build'
const RELAUNCH_OTHER_KEY = 'relaunch-other-build'

/// A second copy is allowed, but the user must see what they are getting into:
/// the same build shares its saves between both processes.
function confirmSecondCopy(profile: string): Promise<boolean> {
  const list = useGame.getState().list
  if (!list.length) return Promise.resolve(true)
  const same = list.includes(profile)
  return uiConfirm(
    same
      ? 'Сборка «' +
          profile +
          '» уже запущена. Вторая копия будет писать в те же миры — одиночный мир может испортиться. Запустить ещё раз?'
      : 'Уже запущена сборка «' + list[0] + '». Запустить ещё и «' + profile + '»? Игры поделят память компьютера.',
    {
      title: 'Игра уже запущена',
      confirmLabel: 'Запустить ещё раз',
      cancelLabel: 'Не запускать',
      danger: same,
      rememberKey: same ? RELAUNCH_SAME_KEY : RELAUNCH_OTHER_KEY,
      rememberLabel: 'Больше не спрашивать',
    },
  )
}

export function joinWithAuth(
  profile: string,
  world: string | null,
  server: string | null,
  serverName?: string | null,
  opts?: { confirmed?: boolean },
) {
  if (launching) {
    showToast('Игра уже запускается')
    return Promise.resolve(JOIN_SKIPPED)
  }
  if (!opts?.confirmed && useGame.getState().list.length)
    return confirmSecondCopy(profile).then((ok) => (ok ? doJoin(profile, world, server, serverName) : JOIN_SKIPPED))
  return doJoin(profile, world, server, serverName)
}

function doJoin(profile: string, world: string | null, server: string | null, serverName?: string | null) {
  if (launching) {
    showToast('Игра уже запускается')
    return Promise.resolve(JOIN_SKIPPED)
  }
  // Same reason as in doLaunch: no core means no game and no way to notice it ended.
  if (!hasTauri()) return Promise.resolve(JOIN_SKIPPED)
  launching = true
  setGameSession(profile, server, serverName)
  pinJoinedServer(profile, world ? null : server, serverName)
  heartbeat('playing', serverName || server)
  const epoch = cancelEpoch
  return resolveAuth(profile)
    .then((a) => {
      if (epoch !== cancelEpoch) throw new Error(CANCELLED_TEXT)
      return quickPlay(profile, a.nick, ramMbFor(profile), world, server, a.auth)
    })
    .then((res) => {
      useGame.getState().addRunning(profile)
      applyLaunchWindowMode()
      return res
    })
    .catch((e) => {
      if (epoch !== cancelEpoch) throw e
      setGameSession(null)
      heartbeat('lobby')
      if (String(e).includes(CANCELLED_TEXT)) throw e
      throw e
    })
    .finally(() => {
      if (epoch === cancelEpoch) launching = false
    })
}

/**
 * A quick join leaves no trace in the in-game list, so a player who drops out
 * has no way back.
 */
function pinJoinedServer(profile: string, server: string | null, serverName?: string | null) {
  if (!server || !hasTauri()) return
  void pinServerDat(profile, serverName || server, server).catch((e) => console.warn('[join] servers.dat', e))
}

export function realLaunch(name: string) {
  if (launching) {
    showToast('Игра уже запускается')
    return
  }
  if (useGame.getState().list.length) {
    const prof = name || useProfiles.getState().selected || 'default'
    void confirmSecondCopy(prof).then((ok) => {
      if (ok) doLaunch(name)
    })
    return
  }
  doLaunch(name)
}

function doLaunch(name: string) {
  if (launching) {
    showToast('Игра уже запускается')
    return
  }
  launching = true
  const setPrelaunch = useUi.getState().setPrelaunch
  const pack = useProfiles.getState().profiles.find((p) => p.name === name)
  const ver = pack ? (pack.version === 'latest' ? 'Minecraft последней версии' : 'Minecraft ' + pack.version) : 'Minecraft последней версии'
  setPrelaunch({ open: true, sub: name + ' · ' + ver, stage: 0, pct: 2, msg: 'Готовимся…', mode: 'launch' })
  try {
    localStorage.setItem('m-last-' + name, String(Date.now()))
  } catch {}
  // Without the core there is no game process to watch: the session flag would
  // never be cleared, and every later beat reports "playing" forever. The server
  // measures those beats itself, so one stuck flag farms hours the player never
  // played (dark_eremite, 18.08.2026: 18 h counted locally against 70 h on the site).
  if (!hasTauri()) {
    launching = false
    return
  }
  try {
    setGameSession(name)
    heartbeat('playing')
  } catch {}
  // The subscription can resolve after the launch finished; unsubscribe explicitly or it leaks.
  let unlisten: UnlistenFn | null = null
  let finished = false
  const stopProgress = () => {
    finished = true
    if (unlisten) unlisten()
    unlisten = null
  }
  listenLaunchProgress((p) => {
    if (p.stage) String(p.stage).slice(0, 24)
    setPrelaunch({ stage: STAGE_IDX[p.stage] ?? 0, pct: p.pct, msg: p.msg })
  }).then((u) => {
    if (!u) return
    if (finished) u()
    else unlisten = u
  })
  const prof = name || useProfiles.getState().selected
  const epoch = cancelEpoch
  const inv = resolveAuth(prof || null)
    .then((a) => {
      if (epoch !== cancelEpoch) throw new Error(CANCELLED_TEXT)
      return prof
        ? launchProfile(prof, a.nick, ramMbFor(prof), a.auth)
        : launchGame('latest', a.nick, false, ramMbFor('default'), a.auth)
    })
  inv
    .then(() => {
      useGame.getState().addRunning(prof || 'default')
      window.dispatchEvent(new Event('copper-game-started'))
      setTimeout(() => {
        setPrelaunch({ open: false })
        showToast('Игра запущена')
        applyLaunchWindowMode()
      }, 1200)
      stopProgress()
    })
    .catch((err) => {
      stopProgress()
      // The core unwinds a cancelled launch later, when the card and the flag
      // may already belong to the next launch.
      if (epoch !== cancelEpoch) return
      setPrelaunch({ open: false })
      setGameSession(null)
      if (String(err).includes('отмен')) return
      showLaunchError(err)
    })
    .finally(() => {
      if (epoch === cancelEpoch) launching = false
    })
}

let plTimer: ReturnType<typeof setInterval> | null = null

export function startPrelaunch(name: string) {
  const setPrelaunch = useUi.getState().setPrelaunch
  let stage = 0
  let prog = 0
  setPrelaunch({ open: true, sub: name, stage, pct: prog, msg: null, mode: 'launch' })
  if (plTimer) clearInterval(plTimer)
  plTimer = setInterval(() => {
    prog += Math.random() * 7 + 3
    if (prog >= (stage + 1) * 25) stage = Math.min(stage + 1, 3)
    if (prog >= 100) {
      prog = 100
      stage = 4
      setPrelaunch({ stage, pct: prog })
      if (plTimer) clearInterval(plTimer)
      setTimeout(() => {
        setPrelaunch({ open: false })
        showToast('Игра запущена — лаунчер свернётся')
      }, 900)
      return
    }
    setPrelaunch({ stage, pct: prog })
  }, 260)
}

export function cancelPrelaunch() {
  cancelEpoch++
  if (plTimer) clearInterval(plTimer)
  const ui = useUi.getState()
  // A repair reports its own outcome once the core unwinds; announcing anything
  // here would race it with a second toast.
  const repair = ui.prelaunch.mode === 'repair'
  if (hasTauri()) cancelLaunch().catch(() => {})
  if (repair) {
    ui.setPrelaunch({ msg: 'Отменяем…' })
    return
  }
  ui.setPrelaunch({ open: false })
  launching = false
  showToast('Запуск отменён')
}
