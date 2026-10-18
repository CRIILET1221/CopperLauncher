import { exit } from '@tauri-apps/plugin-process'
import { hasTauri, tauri } from '../ipc/tauri'
import { isFlatpak, updateCheck, updateRun, updateStage, type LauncherUpdate } from '../ipc/commands'
import { readPref } from './prefs'
import { showToast } from '../state/ui'
import { useUpdate } from '../state/update'
import { openExt } from './api'
import { reportError } from './crash'
import { DEMO_USER } from './demo'

/// Обновления лаунчера идут через GitHub Releases: ядро сверяет тег с версией
/// сборки, качает Copper-Setup.exe, проверяет sha256 и запускает установщик.
export const RELEASES_PAGE = 'https://github.com/CRIILET1221/CopperLauncher/releases/latest'

let pending: LauncherUpdate | null = null

export const pendingUpdate = () => pending

/// Ошибки обновления не фатальны: только в локальную диагностику.
function updateFailed(e: unknown) {
  void reportError('updater', e)
}

/// Flatpak обновляет себя сам и монтирует /app только на чтение.
let managedOutside: boolean | null = null

async function updatesManagedOutside(): Promise<boolean> {
  if (managedOutside === null) managedOutside = await isFlatpak().catch(() => false)
  return managedOutside
}

export function betaChannel(): boolean {
  return readPref('m-beta', '') === '1'
}

/// В браузерном демо ядра нет: показываем выдуманный релиз, чтобы видеть плашку.
const DEMO_UPDATE: LauncherUpdate = {
  version: '2.0.1',
  notes: 'Демо-релиз для просмотра интерфейса.',
  page: RELEASES_PAGE,
  url: '',
  size: 0,
  sha256: '',
}

function remember(upd: LauncherUpdate | null) {
  const st = useUpdate.getState()
  pending = upd
  if (!upd) {
    st.set({ version: null, notes: '', page: '' })
    return
  }
  // Новая версия, вышедшая после «Позже», снова показывается.
  const hidden = st.hidden && st.version === upd.version
  st.set({ version: upd.version, notes: upd.notes, page: upd.page || RELEASES_PAGE, hidden })
}

/// Тихая проверка при запуске и раз в полчаса; loud — по кнопке в Настройках.
export async function checkForUpdate(loud = false): Promise<LauncherUpdate | null> {
  if (DEMO_USER) {
    remember(DEMO_UPDATE)
    return pending
  }
  if (!hasTauri()) {
    if (loud) showToast('Обновления доступны в приложении лаунчера', 'error')
    return null
  }
  try {
    const upd = await updateCheck(betaChannel())
    remember(upd)
    if (loud && !upd) showToast('Стоит последняя версия')
    return upd
  } catch (e) {
    updateFailed(e)
    if (loud) showToast('Не удалось проверить обновления: ' + e, 'error')
    return null
  }
}

async function quit(): Promise<void> {
  try {
    await exit(0)
  } catch {
    const T = tauri()
    const w = T && T.window ? T.window.getCurrentWindow() : null
    if (w && w.destroy) await w.destroy().catch(() => {})
  }
}

/// «Обновить»: скачать установщик, проверить, запустить и закрыть лаунчер.
export async function applyUpdate(): Promise<void> {
  const st = useUpdate.getState()
  if (st.busy || !st.version) return
  const page = st.page || RELEASES_PAGE
  if (DEMO_USER) {
    showToast('В демо обновление не ставится')
    return
  }
  if (await updatesManagedOutside()) {
    showToast('Обнови лаунчер в магазине приложений или командой: flatpak update io.copper.launcher')
    return
  }
  const T = tauri()
  if (!T) return
  st.set({ busy: true, pct: 0 })
  const unlisten = await T.event
    .listen<number>('launcher-update-progress', (e) => useUpdate.getState().set({ pct: e.payload }))
    .catch(() => null)
  try {
    await updateStage(betaChannel())
    useUpdate.getState().set({ pct: 100 })
    await updateRun()
    await quit()
  } catch (e) {
    updateFailed(e)
    useUpdate.getState().set({ busy: false, pct: null })
    showToast('Обновиться не вышло: ' + e + '. Открываем страницу релиза', 'error')
    openExt(page)
  } finally {
    if (unlisten) unlisten()
  }
}

/// «Позже»: до следующего запуска (или до следующей версии) не напоминаем.
export function postponeUpdate() {
  useUpdate.getState().set({ hidden: true })
}
