import { Suspense,lazy,useEffect } from 'react'
import { PixelTip } from './components/PixelTip'
import { HubTopTabs,Sidebar } from './components/Sidebar'
import { SvgSprite } from './components/SvgSprite'
import { Titlebar } from './components/Titlebar'
import { LaunchToast,Toast } from './components/Toast'
import { PlayhubBar } from './components/playhub/MyBuilds'
import { useLayout } from './state/layout'
import type { ScreenId } from './state/ui'
// Screens are mounted only while open, and their chunks are prewarmed after boot
// so switching tabs stays instant.
import { BuildPicker } from './components/BuildPicker'
import { ConfirmModal } from './components/ConfirmModal'
import { CrashModal } from './components/CrashModal'
import { DepPlanModal } from './components/DepPlanModal'
import { Guard } from './components/Guard'
import { ImageLightbox } from './components/ImageLightbox'
import { Installs } from './components/Installs'
import { PackDrop } from './components/PackDrop'
import { UpdateBanner } from './components/UpdateBanner'
import { frontendReady } from './ipc/commands'
import { listenGameCrash,listenGameExit,listenGameServer,listenLaunchWarning,listenTrayExit } from './ipc/events'
import type { UnlistenFn } from './ipc/tauri'
import { hasTauri,tauri } from './ipc/tauri'
import { initAccent } from './lib/accent'
import { initAutostart } from './lib/autostart'
import { hideBoot, showBootWindow } from './lib/boot'
import { flushNativeCrashes,installErrorHandlers } from './lib/crash'
import { initDeepLinks } from './lib/deeplink'
import { initDensity } from './lib/density'
import { modalToClose,openLayers } from './lib/escClose'
import { warmHeads } from './lib/heads'
import { gameSession, heartbeat, reconcileGameSession, setGameSession, updateSessionServer } from './lib/launch'
import { flushPrefs,hydratePrefs } from './lib/prefs'
import { forgetCrash,rememberCrash } from './lib/repair'
import { initSecrets } from './lib/secure'
import { enterApp } from './lib/session'
import { useSlidingSegs } from './lib/slidingSegs'
import { checkForUpdate } from './lib/updater'
import { reportWebviewFailure,setLauncherIdleMemory } from './lib/webviewHealth'
import { hideLauncherToTray,initTray,restoreLauncher,restoreOnGameExit,trayCloseEnabled } from './lib/window'
import { AccountAddModal } from './modals/AccountAdd'
import { ImportModal } from './modals/Import'
import { MigrateBuildModal } from './modals/MigrateBuild'
import { MoveBuildsModal } from './modals/MoveBuilds'
import { NewBuildModal } from './modals/NewBuild'
import { ModpackVersionsOverlay,ScreenshotsOverlay } from './modals/Overlays'
import { ProjectModal } from './modals/Project'
import {
Builds,
Game,
Mods,
Play,
PlayHub,
Settings,
preloadScreens
} from './screens/registry'
import { useAccounts } from './state/accounts'
import { useCrash } from './state/crash'
import { syncRunningGame,useGame } from './state/game'
import { initInstalls } from './state/installs'
import { useMods } from './state/mods'
import { useUpdate } from './state/update'
import { refreshMsAccounts } from './state/msLogin'
import { refreshPlayStats,rememberServerName,serverNameFor,watchPlaytimeWhileRunning } from './state/playStats'
import { refreshProfiles } from './state/profiles'
import { closeModal, showToast, useUi } from './state/ui'
import { useWallpaper } from './state/wallpaper'
const InstancePage = lazy(() => import('./modals/InstancePage').then((m) => ({ default: m.InstancePage })))
let gameStartedAt = 0
export function App() {
  useSlidingSegs()
  const classic = useLayout((st) => st.layout === 'classic')
  // Subscribe field by field: subscribing to the whole store re-rendered the active
  // screen on every toast, animation frame and install progress event.
  const logged = useUi((s) => s.logged)
  const screen = useUi((s) => s.screen)
  const setScreen = useUi((s) => s.setScreen)
  const instanceMounted = useUi((s) => s.modals.bsModal.open || s.modals.bsModal.vis)

  useEffect(() => {
    // Until this lands, the native watchdog treats the window as blank and
    // reinstalls the launcher.
    void showBootWindow(frontendReady)
    installErrorHandlers()

    void initAccent()
    void initDensity()
    initTray()
    void initAutostart()
    initDeepLinks()
    initInstalls()
    // Сборки обновляются только при «Играть» (владелец 08.10.2026: фоновая докачка мешала) — initPackAutoUpdate не запускаем.
    preloadScreens()
    // Обновление лаунчера: проверка GitHub Releases при запуске и раз в полчаса.
    void checkForUpdate()
    const updPoll = setInterval(() => {
      if (!useUpdate.getState().busy) void checkForUpdate()
    }, 1_800_000)
    // The launcher can sit in the tray longer than an MC token lives, so refresh
    // near-expiry accounts periodically.
    const msPoll = setInterval(() => {
      void refreshMsAccounts()
    }, 1_800_000)
    const onVisible = () => {
      if (document.hidden) {
        void flushPrefs()
        setLauncherIdleMemory(true)
        return
      }
      setLauncherIdleMemory(false)
      heartbeat()
    }
    document.addEventListener('visibilitychange', onVisible)
    const onLeave = () => void flushPrefs()
    window.addEventListener('pagehide', onLeave)
    const safety = setTimeout(hideBoot, 4000)
    // The "logged in at least once" flag lives in the durable prefs file, so the
    // disk copy has to land before boot decides whether this account may skip login.
    void Promise.all([initSecrets(), hydratePrefs()]).then(() => {
      clearTimeout(safety)
      enterApp()
      void refreshProfiles()

      warmHeads(useAccounts.getState().list.filter((x) => !x.avatar).map((x) => x.nick))
      void refreshMsAccounts()
      void flushNativeCrashes()
      hideBoot()
      void reportWebviewFailure()
    })
    return () => {
      clearInterval(updPoll)
      clearInterval(msPoll)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pagehide', onLeave)
    }
  }, [])

  useEffect(() => {
    const T = tauri()
    const w = hasTauri() && T && T.window ? T.window.getCurrentWindow() : null
    if (!w || !w.onCloseRequested) return
    let unlisten: UnlistenFn | null = null
    void w
      .onCloseRequested(async (e) => {
        if (!trayCloseEnabled()) return
        e.preventDefault()
        hideLauncherToTray()
      })
      .then((u) => {
        unlisten = u
      })
      .catch(() => {})
    return () => {
      if (unlisten) unlisten()
    }
  }, [])

  // The core allows ~1.5s here before it exits on its own.
  useEffect(() => {
    let unlisten: UnlistenFn | null = null
    void listenTrayExit(() => {
      void flushPrefs()
    }).then((u) => {
      unlisten = u
    })
    return () => {
      if (unlisten) unlisten()
    }
  }, [])

  useEffect(() => {
    let unlisten: UnlistenFn | null = null
    void listenLaunchWarning((msg) => showToast(msg, 'error')).then((u) => {
      unlisten = u
    })
    return () => {
      if (unlisten) unlisten()
    }
  }, [])

  useEffect(() => {
    // Статус в Discord сверяется с запущенными играми; в фоне — реже.
    let lastBeat = 0
    const t = setInterval(() => {
      const quiet = document.hidden && !gameSession()
      if (Date.now() - lastBeat < (quiet ? 55000 : 45000)) return
      lastBeat = Date.now()
      void reconcileGameSession().then(() => heartbeat('lobby'))
    }, 15000)
    const t0 = setTimeout(() => heartbeat('lobby'), 1500)
    syncRunningGame()
    let unlisten: (() => void) | null = null
    const onGameStarted = () => {
      gameStartedAt = Date.now()
    }
    window.addEventListener('copper-game-started', onGameStarted)

    // Пока идёт игра, счёт часов перечитывается сам: ядро пишет его раз в
    // минуту, а до сих пор интерфейс спрашивал только при выходе, и под
    // запущенной сборкой время не появлялось вовсе.
    watchPlaytimeWhileRunning(() => useGame.getState().list.length > 0)
    void listenGameExit((profile) => {
      // Отыграл спокойно 3+ минуты — план вылета, случившегося до этого запуска, больше не нужен,
      // а починка перед ним засчитывается.
      const calm = !!gameStartedAt && Date.now() - gameStartedAt > 180_000
      if (calm) forgetCrash(profile, gameStartedAt)
      useGame.getState().removeRunning(profile)
      // A second copy may still be alive — only the last exit puts the launcher back into lobby.
      if (useGame.getState().list.length) {
        void refreshPlayStats()
        showToast('Игра «' + profile + '» закрыта')
        return
      }
      gameStartedAt = 0
      setGameSession(null)
      heartbeat('lobby')
      void refreshPlayStats()
      if (restoreOnGameExit()) restoreLauncher()
      showToast('Игра закрыта')
    }).then((u) => {
      unlisten = u
    })
    let unServer: UnlistenFn | null = null
    void listenGameServer((addr) => {
      const name = addr ? serverNameFor(addr) : ''
      if (addr && name) rememberServerName(addr, name)
      updateSessionServer(addr || null, name || null)
      void refreshPlayStats()
    }).then((u) => {
      unServer = u
    })
    let unCrash: UnlistenFn | null = null
    void listenGameCrash((info) => {
      // Слаг сборки в событии — чтобы «здоровье сборки» знало, чья это
      // ошибка, а не угадывало по последнему запуску на устройстве; mc и
      // загрузчик — чтобы не склеивать их с запусками задним числом.
      useCrash.getState().show(info)
      if (info && info.profile) rememberCrash(info)
    }).then((u) => {
      unCrash = u
    })
    return () => {
      window.removeEventListener('copper-game-started', onGameStarted)
      clearInterval(t)
      clearTimeout(t0)
      if (unlisten) unlisten()
      if (unServer) unServer()
      if (unCrash) unCrash()
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const id = modalToClose(openLayers())
      if (id) closeModal(id)
      useWallpaper.getState().setPopOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <SvgSprite />

      <div className="window" id="win">
        <Titlebar />
        <UpdateBanner />



        <div className="app" id="scr-app" style={{ display: logged ? 'flex' : 'none' }}>
          {(() => {
            const onNav = (s: ScreenId) => {
              if (s === 'mods') useMods.getState().scopeTo(null)
              setScreen(s)
              const c = document.querySelector('.content')
              if (c) c.scrollTop = 0
            }
            return <Sidebar onNav={onNav} />
          })()}
          <main className="content">
            {/* Классика: шапки с вкладками нет — переключатель «Мои сборки / Каталог» над экраном. */}
            {classic && screen === 'playhub' ? (
              <div className="cl-hubbar">
                <HubTopTabs libLabel="Мои сборки" />
                <span className="cl-hubbar-act">
                  <PlayhubBar />
                </span>
              </div>
            ) : null}
            {/* Navigation runs in a transition, so the fallback only ever shows on
                the very first render. */}
            <Suspense fallback={null}>
              {screen === 'play' && (
                <Guard what="Лобби">
                  <Play on />
                </Guard>
              )}
              {screen === 'builds' && (
                <Guard what="Сборки">
                  <Builds on />
                </Guard>
              )}
              {screen === 'mods' && (
                <Guard what="Каталог">
                  <Mods on />
                </Guard>
              )}
              {screen === 'playhub' && (
                <Guard what="Библиотека">
                  <PlayHub on />
                </Guard>
              )}
              {screen === 'game' && (
                <Guard what="Игра">
                  <Game on />
                </Guard>
              )}
              {screen === 'settings' && (
                <Guard what="Настройки">
                  <Settings on />
                </Guard>
              )}
            </Suspense>
          </main>
        </div>

        {instanceMounted && (
          <Suspense fallback={null}>
            <InstancePage />
          </Suspense>
        )}
        <ImportModal />
        <MoveBuildsModal />
        <ProjectModal />
        <NewBuildModal />
        <AccountAddModal />
        <ScreenshotsOverlay />
        <ModpackVersionsOverlay />
        <MigrateBuildModal />
        <BuildPicker />
        <DepPlanModal />
        <CrashModal />
        {/* Mounted last: it asks on top of any other modal, and DOM order breaks
            ties between equal z-index values. */}
        <ConfirmModal />
        <ImageLightbox />

        <Installs />
        <PackDrop />
        <LaunchToast />
        <Toast />
        <PixelTip />
      </div>
    </>
  )
}
