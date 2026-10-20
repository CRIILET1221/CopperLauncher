import { MODRINTH_API, mirrorAsset } from '../lib/api'

/* ── Зависимости: id проектов Modrinth → название и иконка ── */

export interface DepProject {
  id: string
  slug: string
  title: string
  icon: string
  type: string
}

const depCache = new Map<string, DepProject>()

/** Названия и иконки проектов одним запросом (/v2/projects?ids=…), с кэшем на сессию. */
export async function depProjects(ids: string[]): Promise<Map<string, DepProject>> {
  const want = [...new Set(ids)].filter((id) => id && !depCache.has(id))
  if (want.length) {
    try {
      const url = MODRINTH_API + '/v2/projects?ids=' + encodeURIComponent(JSON.stringify(want.slice(0, 60)))
      const list = (await fetch(url).then((r) => r.json())) as {
        id: string
        slug: string
        title: string
        icon_url?: string | null
        project_type?: string
      }[]
      for (const p of Array.isArray(list) ? list : []) {
        depCache.set(p.id, {
          id: p.id,
          slug: p.slug,
          title: p.title,
          icon: mirrorAsset(p.icon_url) || '',
          type: p.project_type || 'mod',
        })
      }
    } catch {}
  }
  const out = new Map<string, DepProject>()
  for (const id of ids) {
    const p = depCache.get(id)
    if (p) out.set(id, p)
  }
  return out
}
