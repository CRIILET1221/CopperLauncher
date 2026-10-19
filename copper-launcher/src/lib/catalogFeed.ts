import { cfBrowse } from '../ipc/commands'
import { hasTauri } from '../ipc/tauri'
import { MODRINTH_API, mirrorAsset } from './api'
import { cachedCatalog } from './catalogCache'

/*
 * Лента каталога: Modrinth и CurseForge с фильтрами как на их сайтах.
 *
 * Оба источника отдают одну и ту же строку (FeedItem), чтобы экран не знал,
 * откуда она пришла. CurseForge в приложении идёт через ядро (cf_browse), а в
 * браузерном демо — напрямую на зеркало: оно отвечает с CORS `*`.
 */

export type FeedSource = 'modrinth' | 'curseforge'
export type FeedKind = 'mod' | 'modpack' | 'resourcepack' | 'shader' | 'datapack' | 'world'

export const FEED_KINDS: Record<FeedSource, [FeedKind, string][]> = {
  modrinth: [
    ['mod', 'Моды'],
    ['modpack', 'Сборки'],
    ['resourcepack', 'Ресурспаки'],
    ['shader', 'Шейдеры'],
    ['datapack', 'Дата-паки'],
  ],
  curseforge: [
    ['mod', 'Моды'],
    ['modpack', 'Сборки'],
    ['resourcepack', 'Ресурспаки'],
    ['shader', 'Шейдеры'],
    ['datapack', 'Дата-паки'],
    ['world', 'Миры'],
  ],
}

export const FEED_SORTS: Record<FeedSource, [string, string][]> = {
  modrinth: [
    ['relevance', 'Релевантность'],
    ['downloads', 'Скачивания'],
    ['follows', 'Подписчики'],
    ['newest', 'Новые'],
    ['updated', 'Обновлённые'],
  ],
  curseforge: [
    ['1', 'Релевантность'],
    ['2', 'Популярность'],
    ['6', 'Скачивания'],
    ['3', 'Обновлённые'],
    ['11', 'Новые'],
    ['12', 'Рейтинг'],
    ['4', 'По названию'],
  ],
}

/** Загрузчики, по которым сайт фильтрует этот тип. Пусто — фильтра нет. */
export function feedLoaders(source: FeedSource, kind: FeedKind): [string, string][] {
  if (kind === 'mod' || kind === 'modpack') {
    const base: [string, string][] = [
      ['fabric', 'Fabric'],
      ['forge', 'Forge'],
      ['neoforge', 'NeoForge'],
      ['quilt', 'Quilt'],
    ]
    return base
  }
  if (source === 'modrinth' && kind === 'shader')
    return [
      ['iris', 'Iris'],
      ['optifine', 'OptiFine'],
      ['canvas', 'Canvas'],
      ['vanilla', 'Ванильные'],
    ]
  return []
}

/** Окружение (клиент/сервер) есть только у Modrinth и только у модов и сборок. */
export const feedHasSide = (source: FeedSource, kind: FeedKind) =>
  source === 'modrinth' && (kind === 'mod' || kind === 'modpack' || kind === 'datapack')

export interface FeedFilters {
  query: string
  version: string
  loader: string
  cats: string[]
  side: 'any' | 'client' | 'server'
  sort: string
}

export interface FeedItem {
  source: FeedSource
  /** id проекта Modrinth или число CurseForge строкой. */
  id: string
  slug: string
  title: string
  author: string
  icon?: string
  desc: string
  downloads: number
  follows: number
  /** ISO-дата последнего обновления. */
  updated: string
  cats: string[]
  website: string
  /** CurseForge: автор запретил скачивание через API — только с сайта. */
  distributable: boolean
  /** Как вещь записана в сборке: id Modrinth или `cf:<id>`. */
  pid: string
}

export interface FeedPage {
  items: FeedItem[]
  total: number
  /** Смещение следующей страницы; null — дальше ничего. */
  next: number | null
}

export interface FeedCategory {
  id: string
  name: string
  group: string
  /** Подкатегория CurseForge — рисуется с отступом под родителем. */
  child?: boolean
}

const MR_PAGE = 20
const CF_PAGE = 30
const CF_GAME = '432'
const CF_CLASS: Record<FeedKind, number> = {
  mod: 6,
  modpack: 4471,
  resourcepack: 12,
  shader: 6552,
  datapack: 6945,
  world: 17,
}
const CF_LOADER: Record<string, string> = { forge: '1', fabric: '4', quilt: '5', neoforge: '6' }
const CF_MIRROR = 'https://api.curse.tools'

const LOADER_TAGS = new Set([
  'fabric', 'forge', 'neoforge', 'quilt', 'liteloader', 'modloader', 'rift', 'babric', 'legacy-fabric', 'ornithe', 'nilloader', 'bta-babric', 'java-agent',
  'bukkit', 'spigot', 'paper', 'purpur', 'folia', 'sponge', 'velocity', 'waterfall', 'bungeecord',
  'iris', 'optifine', 'canvas', 'vanilla', 'minecraft', 'datapack',
])

/** Русские подписи категорий обоих сайтов; чего нет — показываем как есть. */
const RU: Record<string, string> = {
  adventure: 'Приключения', cursed: 'Проклятое', decoration: 'Декор', economy: 'Экономика', equipment: 'Снаряжение',
  food: 'Еда', 'game-mechanics': 'Механики', library: 'Библиотеки', magic: 'Магия', management: 'Управление',
  minigame: 'Мини-игры', mobs: 'Мобы', optimization: 'Оптимизация', social: 'Общение', storage: 'Хранение',
  technology: 'Технологии', transportation: 'Транспорт', utility: 'Утилиты', worldgen: 'Генерация мира',
  challenging: 'Сложные', combat: 'Бой', 'kitchen-sink': 'Всё и сразу', lightweight: 'Лёгкие', multiplayer: 'Мультиплеер',
  quests: 'Квесты', atmosphere: 'Атмосфера', bloom: 'Свечение', 'colored-lighting': 'Цветной свет', foliage: 'Листва',
  'path-tracing': 'Трассировка', pbr: 'PBR', reflections: 'Отражения', shadows: 'Тени', cartoon: 'Мультяшные',
  fantasy: 'Фэнтези', realistic: 'Реалистичные', 'semi-realistic': 'Полуреализм', 'vanilla-like': 'Как ванилла',
  high: 'Высокая', low: 'Низкая', medium: 'Средняя', potato: 'Для слабых ПК', screenshot: 'Для скриншотов',
  audio: 'Звуки', blocks: 'Блоки', 'core-shaders': 'Core-шейдеры', entities: 'Существа', environment: 'Окружение',
  fonts: 'Шрифты', gui: 'Интерфейс', items: 'Предметы', locale: 'Язык', models: 'Модели', modded: 'Для модов',
  simplistic: 'Минимализм', themed: 'Тематические', tweaks: 'Твики',
  // CurseForge
  'Armor, Tools, and Weapons': 'Броня и оружие', 'Server Utility': 'Для сервера', 'Map and Information': 'Карты и инфо',
  Addons: 'Аддоны', 'Bug Fixes': 'Исправления', 'API and Library': 'Библиотеки', Food: 'Еда', Education: 'Обучение',
  Technology: 'Технологии', Storage: 'Хранение', 'Utility & QoL': 'Утилиты', Redstone: 'Редстоун', Miscellaneous: 'Разное',
  'World Gen': 'Генерация мира', Performance: 'Оптимизация', Cosmetic: 'Косметика', 'Adventure and RPG': 'Приключения и RPG',
  Magic: 'Магия', Horror: 'Хоррор', Dimensions: 'Измерения', Biomes: 'Биомы', Mobs: 'Мобы', Structures: 'Постройки',
  'Ores and Resources': 'Руды и ресурсы', Farming: 'Фермерство', Automation: 'Автоматизация', Genetics: 'Генетика',
  'Player Transport': 'Транспорт', Energy: 'Энергия', Processing: 'Переработка', 'Energy, Fluid, and Item Transport': 'Трубы и передача',
  'Extra Large': 'Огромные', 'Small / Light': 'Лёгкие', 'Combat / PvP': 'Бой / PvP', 'Sci-Fi': 'Научная фантастика',
  Quests: 'Квесты', Tech: 'Технологии', Skyblock: 'Скайблок', 'Map Based': 'На карте', Multiplayer: 'Мультиплеер',
  'Mini Game': 'Мини-игры', 'Vanilla+': 'Ванилла+', Hardcore: 'Хардкор', Exploration: 'Исследование', Expert: 'Эксперт',
  'Photo Realistic': 'Фотореализм', Traditional: 'Классические', 'Font Packs': 'Шрифты', 'Mod Support': 'Поддержка модов',
  Medieval: 'Средневековье', 'Data Packs': 'Дата-паки', Animated: 'Анимированные', Modern: 'Современные', Steampunk: 'Стимпанк',
  Realistic: 'Реалистичные', Fantasy: 'Фэнтези', Vanilla: 'Ванильные', Puzzle: 'Головоломки', Survival: 'Выживание',
  Creation: 'Креатив', 'Modded World': 'С модами', Adventure: 'Приключения', 'Game Map': 'Мини-игры', Parkour: 'Паркур',
  Library: 'Библиотеки', Utility: 'Утилиты', CreativeMode: 'Креатив',
}
export const ruCat = (name: string) => RU[name] || name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ')

const MR_GROUP: Record<string, string> = {
  categories: 'Категории',
  features: 'Особенности',
  resolutions: 'Разрешение',
  'performance impact': 'Нагрузка',
}

async function json(url: string): Promise<any> {
  const r = await fetch(url)
  if (!r.ok) throw new Error('сервер ответил ' + r.status)
  return r.json()
}

/** Запрос к CurseForge: из приложения — ядром, в браузере — прямо на зеркало. */
async function cf(path: 'v1/mods/search' | 'v1/categories', query: [string, string][]): Promise<any> {
  if (hasTauri()) return cfBrowse(path, query)
  return json(CF_MIRROR + '/' + path + '?' + new URLSearchParams(query))
}

/** Релизные версии Minecraft, новые сверху (список Modrinth: он общий для обоих сайтов). */
export function feedGameVersions(): Promise<string[]> {
  const url = MODRINTH_API + '/v2/tag/game_version'
  return cachedCatalog(url, async () => {
    const list = (await json(url)) as { version: string; version_type: string; major: boolean }[]
    return list.filter((v) => v.version_type === 'release').map((v) => v.version)
  })
}

export function feedCategories(source: FeedSource, kind: FeedKind): Promise<FeedCategory[]> {
  if (source === 'modrinth') {
    const url = MODRINTH_API + '/v2/tag/category'
    return cachedCatalog(url, () => json(url)).then((all: { name: string; project_type: string; header: string }[]) => {
      const type = kind === 'datapack' ? 'mod' : kind
      const order = ['categories', 'features', 'resolutions', 'performance impact']
      return all
        .filter((c) => c.project_type === type)
        .sort((a, b) => order.indexOf(a.header) - order.indexOf(b.header) || ruCat(a.name).localeCompare(ruCat(b.name), 'ru'))
        .map((c) => ({ id: c.name, name: ruCat(c.name), group: MR_GROUP[c.header] || 'Категории' }))
    })
  }
  const cls = CF_CLASS[kind]
  return cachedCatalog('cf:cats:' + cls, async () => {
    const d = await cf('v1/categories', [['gameId', CF_GAME], ['classId', String(cls)]])
    const all = ((d && d.data) || []) as { id: number; name: string; parentCategoryId: number }[]
    const top = all.filter((c) => c.parentCategoryId === cls).sort((a, b) => ruCat(a.name).localeCompare(ruCat(b.name), 'ru'))
    const out: FeedCategory[] = []
    for (const t of top) {
      out.push({ id: String(t.id), name: ruCat(t.name), group: 'Категории' })
      all
        .filter((c) => c.parentCategoryId === t.id)
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((c) => out.push({ id: String(c.id), name: ruCat(c.name), group: 'Категории', child: true }))
    }
    return out
  })
}

function mrUrl(kind: FeedKind, f: FeedFilters, offset: number): string {
  const facets: string[][] = [kind === 'datapack' ? ['categories:datapack'] : ['project_type:' + kind]]
  if (f.version) facets.push(['versions:' + f.version])
  if (f.loader) facets.push(['categories:' + f.loader])
  f.cats.forEach((c) => facets.push(['categories:' + c]))
  if (f.side === 'client') facets.push(['client_side:required', 'client_side:optional'])
  if (f.side === 'server') facets.push(['server_side:required', 'server_side:optional'])
  const p = new URLSearchParams({
    limit: String(MR_PAGE),
    offset: String(offset),
    index: f.sort || 'relevance',
    facets: JSON.stringify(facets),
  })
  if (f.query.trim()) p.set('query', f.query.trim())
  return MODRINTH_API + '/v2/search?' + p
}

function mrItem(h: any): FeedItem {
  return {
    source: 'modrinth',
    id: h.project_id,
    slug: h.slug,
    title: h.title,
    author: h.author || '',
    icon: mirrorAsset(h.icon_url),
    desc: h.description || '',
    downloads: h.downloads || 0,
    follows: h.follows || 0,
    updated: h.date_modified || '',
    cats: ((h.display_categories || h.categories || []) as string[]).filter((c) => !LOADER_TAGS.has(c)).slice(0, 3).map(ruCat),
    website: 'https://modrinth.com/' + (h.project_type || 'mod') + '/' + h.slug,
    distributable: true,
    pid: h.project_id,
  }
}

function cfItem(m: any): FeedItem {
  const authors = (m.authors || []) as { name: string }[]
  return {
    source: 'curseforge',
    id: String(m.id),
    slug: m.slug || '',
    title: m.name || '',
    author: authors.map((a) => a.name).slice(0, 2).join(', '),
    icon: mirrorAsset((m.logo && (m.logo.thumbnailUrl || m.logo.url)) || undefined),
    desc: m.summary || '',
    downloads: m.downloadCount || 0,
    follows: m.thumbsUpCount || 0,
    updated: m.dateModified || m.dateReleased || '',
    cats: ((m.categories || []) as { name: string; id: number }[])
      .sort((a, b) => (a.id === m.primaryCategoryId ? -1 : b.id === m.primaryCategoryId ? 1 : 0))
      .slice(0, 3)
      .map((c) => ruCat(c.name)),
    website: (m.links && m.links.websiteUrl) || '',
    // Поле бывает null у старых проектов — это не запрет.
    distributable: m.allowModDistribution !== false,
    pid: 'cf:' + m.id,
  }
}

export async function feedSearch(source: FeedSource, kind: FeedKind, f: FeedFilters, offset: number): Promise<FeedPage> {
  if (source === 'modrinth') {
    const url = mrUrl(kind, f, offset)
    const d = await cachedCatalog('feed:' + url, () => json(url))
    const items = ((d.hits || []) as any[]).map(mrItem)
    const total = d.total_hits || 0
    return { items, total, next: items.length && offset + items.length < total ? offset + items.length : null }
  }
  const q: [string, string][] = [
    ['gameId', CF_GAME],
    ['classId', String(CF_CLASS[kind])],
    ['pageSize', String(CF_PAGE)],
    ['index', String(offset)],
    // Релевантность без запроса у CurseForge — случайная выдача; сайт в этом случае показывает популярное.
    ['sortField', (f.sort || '1') === '1' && !f.query.trim() ? '2' : f.sort],
    // По названию — от А к Я, остальное — сверху самое-самое.
    ['sortOrder', f.sort === '4' ? 'asc' : 'desc'],
  ]
  if (f.query.trim()) q.push(['searchFilter', f.query.trim()])
  if (f.version) q.push(['gameVersion', f.version])
  if (f.loader && CF_LOADER[f.loader]) q.push(['modLoaderType', CF_LOADER[f.loader]])
  if (f.cats.length) q.push(['categoryIds', JSON.stringify(f.cats.slice(0, 10).map(Number))])
  const key = 'feed:cf:' + JSON.stringify(q)
  const d = await cachedCatalog(key, () => cf('v1/mods/search', q))
  const items = (((d && d.data) || []) as any[]).map(cfItem)
  // CurseForge не отдаёт дальше 10 000-й строки.
  const total = Math.min((d && d.pagination && d.pagination.totalCount) || 0, 10000)
  const next = offset + items.length
  return { items, total, next: items.length >= CF_PAGE && next + CF_PAGE <= 10000 ? next : null }
}
