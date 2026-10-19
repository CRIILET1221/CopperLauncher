import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { openCfProject, openProject } from '../state/project'
import { useMods } from '../state/mods'
import { useProfiles } from '../state/profiles'
import { useInstalls } from '../state/installs'
import { PxIcon } from '../components/PxIcon'
import { fmt, loaderId, LOADER_NAME, whenText } from '../lib/format'
import { openExt } from '../lib/api'
import {
  FEED_KINDS,
  FEED_SORTS,
  feedCategories,
  feedGameVersions,
  feedHasSide,
  feedLoaders,
  feedSearch,
} from '../lib/catalogFeed'
import type { FeedCategory, FeedFilters, FeedItem, FeedKind, FeedSource } from '../lib/catalogFeed'
import { feedTaskKey, installFeedItem } from '../lib/feedInstall'
import '../styles/copper.css'
import '../styles/copper-catalog.css'

/*
 * Каталог: две вкладки-источника (Modrinth и CurseForge), внутри типы контента
 * и фильтры как на их сайтах, лента подгружается при прокрутке. «Для сборки»
 * сразу выставляет версию и загрузчик и отмечает уже установленное.
 */

const PREF = 'copper.catalog'
const DEFAULT_SORT: Record<FeedSource, string> = { modrinth: 'relevance', curseforge: '1' }

function readPref(): { source: FeedSource; kind: FeedKind } {
  try {
    const p = JSON.parse(localStorage.getItem(PREF) || '{}')
    const source: FeedSource = p.source === 'curseforge' ? 'curseforge' : 'modrinth'
    const kind = FEED_KINDS[source].some(([k]) => k === p.kind) ? (p.kind as FeedKind) : 'mod'
    return { source, kind }
  } catch {
    return { source: 'modrinth', kind: 'mod' }
  }
}

export function Mods({ on }: { on: boolean }) {
  return (
    <section className={'screen' + (on ? ' on' : '')} id="s-mods">
      <CatalogPane />
    </section>
  )
}

export function CatalogPane(_props: { content?: boolean; onOpenPack?: (slug: string) => boolean | void; servers?: ReactNode }) {
  const start = useMemo(readPref, [])
  const [source, setSource] = useState<FeedSource>(start.source)
  const [kind, setKind] = useState<FeedKind>(start.kind)
  const [query, setQuery] = useState('')
  const [typed, setTyped] = useState('')
  const [version, setVersion] = useState('')
  const [loader, setLoader] = useState('')
  const [cats, setCats] = useState<string[]>([])
  const [side, setSide] = useState<FeedFilters['side']>('any')
  const [sort, setSort] = useState(DEFAULT_SORT[start.source])
  const [items, setItems] = useState<FeedItem[]>([])
  const [total, setTotal] = useState(0)
  const [next, setNext] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [versions, setVersions] = useState<string[]>([])
  const [categories, setCategories] = useState<FeedCategory[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [allVersions, setAllVersions] = useState(false)

  const profiles = useProfiles((s) => s.profiles)
  const build = useMods((s) => s.targetBuild)
  const installedIds = useMods((s) => s.installedIds)
  const tasks = useInstalls((s) => s.tasks)
  const buildProfile = profiles.find((p) => p.name === build) || null

  const listRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const seq = useRef(0)

  const loaders = feedLoaders(source, kind)
  const hasSide = feedHasSide(source, kind)

  useEffect(() => {
    try {
      localStorage.setItem(PREF, JSON.stringify({ source, kind }))
    } catch {}
  }, [source, kind])

  // Поиск по мере ввода — с паузой, чтобы не слать запрос на каждую букву.
  useEffect(() => {
    const t = window.setTimeout(() => setQuery(typed), 350)
    return () => window.clearTimeout(t)
  }, [typed])

  useEffect(() => {
    void feedGameVersions().then(setVersions, () => setVersions([]))
  }, [])

  useEffect(() => {
    let live = true
    setCategories([])
    void feedCategories(source, kind).then(
      (c) => live && setCategories(c),
      () => {},
    )
    return () => {
      live = false
    }
  }, [source, kind])

  // «Установлено» — только когда понятно, про какую сборку речь.
  useEffect(() => {
    if (!build) return
    useMods.getState().set({ modTab: kind === 'world' ? 'world' : 'mod' })
    void useMods.getState().refreshInstalled()
  }, [build, kind])

  const filters: FeedFilters = useMemo(
    () => ({ query, version, loader, cats, side: hasSide ? side : 'any', sort }),
    [query, version, loader, cats, side, hasSide, sort],
  )

  const loadPage = useCallback(
    (offset: number) => {
      const my = ++seq.current
      setBusy(true)
      setError('')
      feedSearch(source, kind, filters, offset)
        .then((page) => {
          if (my !== seq.current) return
          setTotal(page.total)
          setNext(page.next)
          setItems((prev) => {
            if (!offset) return page.items
            const seen = new Set(prev.map((i) => i.id))
            return prev.concat(page.items.filter((i) => !seen.has(i.id)))
          })
        })
        .catch((e) => {
          if (my !== seq.current) return
          setError((source === 'modrinth' ? 'Modrinth' : 'CurseForge') + ' не отвечает: ' + String(e).replace(/^Error: /, ''))
          if (!offset) setItems([])
          setNext(null)
        })
        .finally(() => my === seq.current && setBusy(false))
    },
    [source, kind, filters],
  )

  // Любая смена фильтров — лента с начала.
  useEffect(() => {
    setItems([])
    setNext(null)
    if (listRef.current) listRef.current.scrollTop = 0
    loadPage(0)
  }, [loadPage])

  // Бесконечная лента: подгружаем следующую страницу, когда низ списка близко.
  const more = useRef<() => void>(() => {})
  more.current = () => {
    if (!busy && !error && next !== null) loadPage(next)
  }
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver((e) => e[0]?.isIntersecting && more.current(), {
      root: listRef.current,
      rootMargin: '600px 0px',
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  // Короткая страница не даёт прокрутки — тогда наблюдатель не сработает сам.
  useEffect(() => {
    const el = sentinelRef.current
    const root = listRef.current
    if (!el || !root || busy || next === null) return
    if (el.getBoundingClientRect().top - root.getBoundingClientRect().bottom < 600) more.current()
  }, [items, busy, next])

  const loaderFor = (k: FeedKind, src: FeedSource) => {
    if (!buildProfile) return ''
    const id = loaderId(buildProfile)
    return feedLoaders(src, k).some(([l]) => l === id) ? id : ''
  }

  function pickSource(s: FeedSource) {
    if (s === source) return
    const k = FEED_KINDS[s].some(([x]) => x === kind) ? kind : 'mod'
    setSource(s)
    setKind(k)
    setCats([])
    setSort(DEFAULT_SORT[s])
    setLoader(loader && feedLoaders(s, k).some(([l]) => l === loader) ? loader : loaderFor(k, s))
  }

  function pickKind(k: FeedKind) {
    if (k === kind) return
    setKind(k)
    setCats([])
    setLoader(loaderFor(k, source))
  }

  function pickBuild(name: string) {
    const p = profiles.find((x) => x.name === name) || null
    useMods.getState().set({ targetBuild: p ? p.name : null })
    if (!p) return
    setVersion(p.version || '')
    const id = loaderId(p)
    setLoader(loaders.some(([l]) => l === id) ? id : '')
  }

  function toggleCat(id: string) {
    setCats((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.concat(id)))
  }

  function reset() {
    setCats([])
    setSide('any')
    setTyped('')
    setQuery('')
    setVersion(buildProfile ? buildProfile.version : '')
    setLoader(loaderFor(kind, source))
  }

  const groups = useMemo(() => {
    const g = new Map<string, FeedCategory[]>()
    categories.forEach((c) => g.set(c.group, (g.get(c.group) || []).concat(c)))
    return [...g.entries()]
  }, [categories])

  const shownVersions = useMemo(() => {
    // Новые версии нумеруются по году (26.1, 26.2) — прячем только совсем старые 1.0–1.6.
    const list = allVersions ? versions : versions.filter((v) => !/^1\.[0-6](\.|$)/.test(v))
    return version && !list.includes(version) ? [version, ...list] : list
  }, [versions, allVersions, version])

  const activeCount = cats.length + (version ? 1 : 0) + (loader ? 1 : 0) + (hasSide && side !== 'any' ? 1 : 0)
  const sourceName = source === 'modrinth' ? 'Modrinth' : 'CurseForge'
  const kindName = (FEED_KINDS[source].find(([k]) => k === kind) || ['', ''])[1].toLowerCase()

  return (
    <div className="cc">
      <header className="cc-top">
        <div className="cc-row">
          <div className="cc-sources" role="tablist" aria-label="Источник">
            {(['modrinth', 'curseforge'] as FeedSource[]).map((s) => (
              <button
                key={s}
                role="tab"
                aria-selected={s === source}
                className={'cc-source cc-' + s + (s === source ? ' on' : '')}
                onClick={() => pickSource(s)}
              >
                <span className="cc-source-dot" aria-hidden="true" />
                {s === 'modrinth' ? 'Modrinth' : 'CurseForge'}
              </button>
            ))}
          </div>
          <label className="cc-build">
            <span>Для сборки</span>
            <select value={build || ''} onChange={(e) => pickBuild(e.target.value)} aria-label="Сборка для установки">
              <option value="">— не выбрана —</option>
              {profiles.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} · {p.version} {LOADER_NAME(p)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <nav className="cc-kinds" aria-label="Тип контента">
          {FEED_KINDS[source].map(([k, label]) => (
            <button key={k} className={'cc-kind' + (k === kind ? ' on' : '')} aria-pressed={k === kind} onClick={() => pickKind(k)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="cc-row cc-searchrow">
          <label className="cc-search">
            <PxIcon name="search" />
            <input
              type="search"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={'Искать ' + kindName + ' на ' + sourceName}
              aria-label={'Поиск на ' + sourceName}
            />
          </label>
          <label className="cc-sort">
            <span>Сортировка</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Сортировка">
              {FEED_SORTS[source].map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className={'btn sm cc-filters-btn' + (filtersOpen ? ' primary' : '')} onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen}>
            <PxIcon name="filter" /> Фильтры{activeCount ? ' · ' + activeCount : ''}
          </button>
        </div>
      </header>

      <div className={'cc-body' + (filtersOpen ? ' filters-open' : '')}>
        <aside className="cc-side" aria-label="Фильтры">
          <div className="cc-group">
            <h3>Версия Minecraft</h3>
            <select value={version} onChange={(e) => setVersion(e.target.value)} aria-label="Версия Minecraft">
              <option value="">Любая</option>
              {shownVersions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <label className="cc-check small">
              <input type="checkbox" checked={allVersions} onChange={(e) => setAllVersions(e.target.checked)} />
              <span>Старые версии (до 1.7)</span>
            </label>
          </div>
          {loaders.length ? (
            <div className="cc-group">
              <h3>{kind === 'shader' ? 'Загрузчик шейдеров' : 'Загрузчик'}</h3>
              <div className="cc-chips">
                <button className={'cc-chip' + (!loader ? ' on' : '')} onClick={() => setLoader('')}>
                  Любой
                </button>
                {loaders.map(([id, label]) => (
                  <button key={id} className={'cc-chip' + (loader === id ? ' on' : '')} onClick={() => setLoader(loader === id ? '' : id)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {hasSide ? (
            <div className="cc-group">
              <h3>Окружение</h3>
              <div className="cc-chips">
                {(
                  [
                    ['any', 'Любое'],
                    ['client', 'Клиент'],
                    ['server', 'Сервер'],
                  ] as [FeedFilters['side'], string][]
                ).map(([id, label]) => (
                  <button key={id} className={'cc-chip' + (side === id ? ' on' : '')} onClick={() => setSide(id)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {groups.map(([group, list]) => (
            <div className="cc-group" key={group}>
              <h3>{group}</h3>
              {list.map((c) => (
                <label key={c.id} className={'cc-check' + (c.child ? ' child' : '')}>
                  <input type="checkbox" checked={cats.includes(c.id)} onChange={() => toggleCat(c.id)} />
                  <span>{c.name}</span>
                </label>
              ))}
            </div>
          ))}
          {!categories.length ? <p className="cc-muted">Категории загружаются…</p> : null}
          <button className="btn sm cc-reset" onClick={reset} disabled={!activeCount && !typed}>
            Сбросить фильтры
          </button>
        </aside>

        <div className="cc-list" ref={listRef}>
          <div className="cc-count" role="status">
            {items.length ? fmt(total) + ' ' + (total === 10000 && source === 'curseforge' ? 'и больше' : 'найдено') : busy ? 'Ищем…' : ''}
            {buildProfile ? (
              <span className="cc-for">
                для «{buildProfile.name}» · {buildProfile.version} {LOADER_NAME(buildProfile)}
              </span>
            ) : null}
          </div>
          {items.map((it) => (
            <FeedCard
              key={it.source + it.id}
              item={it}
              kind={kind}
              version={version}
              installed={!!build && installedIds.has(it.pid)}
              taskKey={feedTaskKey(it, kind, tasks)}
            />
          ))}
          {!busy && !error && !items.length ? (
            <div className="cc-empty">
              <b>Ничего не нашли</b>
              <span>Попробуй другой запрос или сними часть фильтров.</span>
              {activeCount ? (
                <button className="btn sm" onClick={reset}>
                  Сбросить фильтры
                </button>
              ) : null}
            </div>
          ) : null}
          {error ? (
            <div className="cc-empty" role="alert">
              <b>{error}</b>
              <button className="btn sm" onClick={() => loadPage(items.length && next !== null ? next : 0)}>
                Повторить
              </button>
            </div>
          ) : null}
          {busy ? (
            <div className="cc-loading" aria-hidden="true">
              {Array.from({ length: items.length ? 2 : 6 }, (_, i) => (
                <div className="cc-card cc-ghost" key={i}>
                  <span className="cc-icon" />
                  <span className="cc-ghost-lines">
                    <i />
                    <i />
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {!busy && items.length && next === null ? <p className="cc-end">Это всё — дальше пусто.</p> : null}
          <div ref={sentinelRef} className="cc-sentinel" />
        </div>
      </div>
    </div>
  )
}

function FeedCard({ item, kind, version, installed, taskKey }: { item: FeedItem; kind: FeedKind; version: string; installed: boolean; taskKey: string | null }) {
  const task = useInstalls((s) => (taskKey ? s.tasks[taskKey] : undefined))
  const open = () =>
    item.source === 'curseforge' ? void openCfProject(Number(item.id), kind, item.title) : void openProject(item.slug, kind)
  const running = task && task.state === 'run'
  const done = installed || (task && task.state === 'done')
  const blocked = item.source === 'curseforge' && !item.distributable
  return (
    <article className="cc-card">
      <button className="cc-icon" onClick={open} tabIndex={-1} aria-hidden="true">
        {item.icon ? <img src={item.icon} alt="" loading="lazy" /> : <span>{item.title.slice(0, 1)}</span>}
      </button>
      <div className="cc-info">
        <div className="cc-title">
          <button className="cc-name" onClick={open}>
            {item.title}
          </button>
          {item.author ? <span className="cc-author">от {item.author}</span> : null}
        </div>
        <p className="cc-desc">{item.desc}</p>
        <div className="cc-meta">
          <span title="Скачиваний">
            <PxIcon name="download" /> {fmt(item.downloads)}
          </span>
          {item.follows ? (
            <span title={item.source === 'modrinth' ? 'Подписчиков' : 'Лайков'}>
              <PxIcon name="heart" /> {fmt(item.follows)}
            </span>
          ) : null}
          {item.updated ? (
            <span title={'Обновлён ' + item.updated.slice(0, 10)}>
              <PxIcon name="clock" /> {whenText(Date.parse(item.updated) / 1000)}
            </span>
          ) : null}
          {item.cats.map((c) => (
            <span className="cc-tag" key={c}>
              {c}
            </span>
          ))}
        </div>
      </div>
      <div className="cc-act">
        {blocked ? (
          <button className="btn sm" onClick={() => openExt(item.website)} title="Автор разрешил скачивать только с сайта CurseForge">
            <PxIcon name="ext" /> На сайте
          </button>
        ) : running ? (
          <button className="btn sm" disabled>
            {task!.pct ? Math.round(task!.pct) + '%' : 'Ставим…'}
          </button>
        ) : done && kind !== 'modpack' ? (
          <span className="cc-installed">
            <PxIcon name="check" /> Установлено
          </span>
        ) : (
          <button className="btn sm primary" onClick={() => void installFeedItem(item, kind, version)}>
            <PxIcon name="download" /> Установить
          </button>
        )}
      </div>
    </article>
  )
}
