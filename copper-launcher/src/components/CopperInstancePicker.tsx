import { useEffect, useId, useRef, useState } from 'react'
import type { Profile } from '../ipc/commands'

function loaderInfo(profile: Profile) {
  const loader = (profile.loader || (profile.fabric ? 'fabric' : 'vanilla')).split('-')[0].toLowerCase()
  const labels: Record<string, [string, string]> = {
    vanilla: ['V', 'Vanilla'], fabric: ['F', 'Fabric'], forge: ['Fo', 'Forge'],
    neoforge: ['N', 'NeoForge'], quilt: ['Q', 'Quilt'],
  }
  return labels[loader] || [loader.slice(0, 2).toUpperCase(), loader]
}

export function CopperInstancePicker({ profiles, selected, disabled, onSelect }: {
  profiles: Profile[]; selected: string; disabled: boolean; onSelect: (name: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const id = useId()
  const index = Math.max(0, profiles.findIndex((p) => p.name === selected))
  const profile = profiles[index]
  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  useEffect(() => {
    const item = open ? document.getElementById(`${id}-${active}`) : null
    if (!item || !menu.current) return
    const row = item.getBoundingClientRect()
    const bounds = menu.current.getBoundingClientRect()
    // Scroll the list itself, never the launcher page behind it.
    if (row.top < bounds.top) menu.current.scrollTop -= bounds.top - row.top
    else if (row.bottom > bounds.bottom) menu.current.scrollTop += row.bottom - bounds.bottom
  }, [open, active, id])
  if (!profile) return null
  const choose = (i: number) => {
    const item = profiles[i]
    if (!item || disabled) return
    onSelect(item.name)
    setOpen(false)
    button.current?.focus()
  }
  const [symbol, loader] = loaderInfo(profile)
  return <div className="copper-instance-picker" ref={root}>
    <button className="copper-instance-trigger" ref={button} role="combobox" type="button"
      aria-label="Инстанс" aria-haspopup="listbox" aria-expanded={open} aria-controls={id}
      aria-activedescendant={open ? `${id}-${active}` : undefined} disabled={disabled}
      onClick={() => { setActive(index); setOpen(!open) }}
      onBlur={(e) => { if (!root.current?.contains(e.relatedTarget as Node)) setOpen(false) }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return }
        if (e.key === 'Tab') { setOpen(false); return }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault()
          if (!open) { setActive(index); setOpen(true) }
          else setActive((i) => Math.max(0, Math.min(profiles.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))))
        } else if (open && (e.key === 'Home' || e.key === 'End')) {
          e.preventDefault(); setActive(e.key === 'Home' ? 0 : profiles.length - 1)
        } else if (open && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); choose(active) }
      }}>
      <span className="copper-loader-badge" aria-hidden="true">{symbol}</span>
      <span className="copper-instance-text"><b>{profile.name}</b><small>{profile.version} · {loader}</small></span>
      <span className="copper-instance-arrow" aria-hidden="true">{open ? '▴' : '▾'}</span>
    </button>
    {open && <div className="copper-instance-options" ref={menu} id={id} role="listbox" aria-label="Инстансы">
      {profiles.map((p, i) => {
        const [mark, title] = loaderInfo(p)
        const chosen = p.name === profile.name
        return <div key={p.name} id={`${id}-${i}`} role="option" aria-selected={chosen}
          className={'copper-instance-option' + (i === active ? ' focused' : '') + (chosen ? ' selected' : '')}
          onPointerMove={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(i)}>
          <span className="copper-loader-badge" aria-hidden="true">{mark}</span>
          <span className="copper-instance-text"><b>{p.name}</b><small>{p.version} · {title}</small></span>
          <span className="copper-instance-check" aria-hidden="true">{chosen ? '✓' : ''}</span>
        </div>
      })}
    </div>}
  </div>
}
