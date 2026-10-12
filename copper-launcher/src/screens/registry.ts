import { lazy } from 'react'
import type { ScreenId } from '../state/ui'

// Imports are shared with lazy() so a prewarmed chunk is reused, not fetched twice.
const loaders = {
  play: () => import('./Play'),
  builds: () => import('./Builds'),
  mods: () => import('./Mods'),
  playhub: () => import('./PlayHub'),
  game: () => import('./Game'),
  settings: () => import('../modals/Settings'),
} satisfies Partial<Record<ScreenId, () => Promise<unknown>>>

export const Play = lazy(() => loaders.play().then((m) => ({ default: m.Play })))
export const Builds = lazy(() => loaders.builds().then((m) => ({ default: m.Builds })))
export const Mods = lazy(() => loaders.mods().then((m) => ({ default: m.Mods })))
export const PlayHub = lazy(() => loaders.playhub().then((m) => ({ default: m.PlayHub })))
export const Game = lazy(() => loaders.game().then((m) => ({ default: m.Game })))
export const Settings = lazy(() => loaders.settings().then((m) => ({ default: m.Settings })))

export function preloadScreen(id: ScreenId) {
  const load = (loaders as Partial<Record<ScreenId, () => Promise<unknown>>>)[id]
  if (load) void load().catch(() => {})
}

export function preloadScreens() {
  const run = () => (['play', 'builds', 'mods', 'game', 'settings'] as ScreenId[]).forEach((id) => preloadScreen(id))
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback
  if (idle) idle(run)
  else setTimeout(run, 1200)
}
