import { cfInstallModpack, cfInstallWorld, installModpack, installModpackVersion } from '../ipc/commands'
import type { Profile, WorldInstall } from '../ipc/commands'
import { hasTauri } from '../ipc/tauri'
import { useProfiles } from '../state/profiles'
import { useInstalls, runInstall } from '../state/installs'
import { uiConfirm } from '../state/confirm'
import { showToast } from '../state/ui'
import { useMods } from '../state/mods'
import { openExt } from './api'
import { installContentFlow, resolveTargetBuild } from './install'
import { keyCfModpack, keyContent, keyMrModpack } from './installKeys'
import { modpackVersionFor } from './modpackVersion'
import type { FeedItem, FeedKind } from './catalogFeed'

/*
 * Кнопка «Установить» на карточке ленты. Моды, паки, шейдеры и дата-паки идут
 * тем же путём, что и окно проекта (installContentFlow: зависимости, проверка
 * версии); сборка создаёт новую сборку; мир ложится в saves выбранной сборки.
 */

/** Задача установки этой карточки, если она сейчас идёт или только что закончилась. */
export function feedTaskKey(item: FeedItem, kind: FeedKind, tasks: Record<string, unknown>): string | null {
  if (kind === 'modpack') return item.source === 'curseforge' ? keyCfModpack(Number(item.id)) : keyMrModpack(item.slug)
  const src = item.source === 'curseforge' ? 'cf' : 'mr'
  const tail = ':' + (item.source === 'curseforge' ? item.id : item.slug)
  const head = src + '-' + kind + ':'
  return Object.keys(tasks).find((k) => k.startsWith(head) && k.endsWith(tail)) || null
}

function installPack(item: FeedItem, version: string) {
  const cf = item.source === 'curseforge'
  runInstall<Profile>({
    key: cf ? keyCfModpack(Number(item.id)) : keyMrModpack(item.slug),
    title: item.title,
    running: 'Скачивание…',
    run: () =>
      cf
        ? cfInstallModpack(Number(item.id))
        : version
          ? modpackVersionFor(item.slug, version).then((id) => installModpackVersion(item.slug, id))
          : installModpack(item.slug),
    onDone: (p) => {
      useProfiles.getState().setSelected(p.name)
      void useProfiles.getState().refresh()
      showToast('Сборка «' + p.name + '» готова — жми «Играть»', 'ok', 'achievement')
    },
  })
}

function installWorld(item: FeedItem, prof: string, force: boolean) {
  const id = Number(item.id)
  runInstall<WorldInstall>({
    key: keyContent('cf', prof, 'world', id),
    title: item.title,
    running: force ? 'Ставим всё равно…' : 'Скачивание…',
    run: () => cfInstallWorld(id, prof, force),
    keepOpen: (r) => !r.folder,
    onDone: (r) => {
      if (!r.folder) {
        const pr = useProfiles.getState().profiles.find((x) => x.name === prof)
        void uiConfirm(
          'Мир «' + item.title + '» рассчитан на ' + (r.mismatch || 'другие версии') + ', а у сборки «' + prof +
            '» версия ' + ((pr && pr.version) || '—') + '. Он может не открыться. Поставить всё равно?',
          { title: 'Версия не совпадает', confirmLabel: 'Поставить', danger: false },
        ).then((ok) => ok && installWorld(item, prof, true))
        return
      }
      void useMods.getState().refreshInstalled()
      showToast('Мир «' + r.folder + '» → «' + prof + '»: заходи в одиночную игру', 'ok', 'install')
    },
  })
}

export async function installFeedItem(item: FeedItem, kind: FeedKind, version: string): Promise<void> {
  if (item.source === 'curseforge' && !item.distributable) {
    // Автор запретил скачивание через API: ядро файл не получит, честнее сразу на сайт.
    openExt(item.website)
    return
  }
  if (!hasTauri()) {
    showToast('Установка доступна в приложении')
    return
  }
  if (kind === 'modpack') return installPack(item, version)
  if (kind === 'world') {
    const prof = await resolveTargetBuild('world')
    if (prof) installWorld(item, prof, false)
    return
  }
  await installContentFlow(
    item.source === 'curseforge' ? { source: 'curseforge', cfid: Number(item.id) } : { source: 'modrinth', slug: item.slug },
    kind,
    item.title,
  )
}

export const useFeedTasks = () => useInstalls((s) => s.tasks)
