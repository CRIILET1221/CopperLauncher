import { useEffect, useState } from 'react'
import type { Profile } from '../../ipc/commands'
import { loadProfileSettings } from '../../ipc/commands'
import { hasTauri } from '../../ipc/tauri'
import { MODRINTH_API, mirrorAsset } from '../../lib/api'
import { diskGet, diskSet } from '../../lib/diskCache'


/*
 * Обложка сборки, поставленной из каталога, — та же картинка, что у неё в «Сборках»
 * (владелец 10.10.2026: «сделай как тут»). Квадратный значок 256 px на широкой карточке
 * смотрелся мылом и пикселями; широкая обложка каталога (1600×900) — чёткая.
 * Откуда сборка — из настроек (modpackSlug Modrinth). Ответ — в памяти и на диске.
 */

const mem = new Map<string, string | null>()
const running = new Map<string, Promise<string | null>>()

async function modrinthCover(slug: string): Promise<string | null> {
  const r = await fetch(MODRINTH_API + '/v2/project/' + encodeURIComponent(slug)).catch(() => null)
  if (!r || !r.ok) return null
  const p = (await r.json().catch(() => null)) as { gallery?: { url: string; raw_url?: string; featured?: boolean }[] } | null
  const g = (p && p.gallery) || []
  const pick = g.find((x) => x.featured) || g[0]
  return pick ? mirrorAsset(pick.url) || pick.url : null
}

async function resolve(p: Profile): Promise<string | null> {
  const st = hasTauri() ? await loadProfileSettings(p.name).catch(() => null) : null
  return st && st.modpackSlug ? modrinthCover(st.modpackSlug) : null
}

export function usePackCover(p: Profile): string | null {
  const key = p.name
  const [cover, setCover] = useState<string | null>(() => mem.get(key) ?? null)
  useEffect(() => {
    let alive = true
    if (mem.has(key)) setCover(mem.get(key) ?? null)
    else
      void diskGet<string | null>('pack-cover:' + key).then((r) => {
        if (alive && r && !mem.has(key)) setCover(r.value)
      })
    let run = running.get(key)
    if (!run) {
      run = resolve(p).finally(() => running.delete(key))
      running.set(key, run)
    }
    void run
      .then((c) => {
        mem.set(key, c)
        diskSet('pack-cover:' + key, c)
        if (alive) setCover(c)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [key])
  return cover
}
