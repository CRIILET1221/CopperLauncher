import { useState } from 'react'
import { CopperSkins } from '../modals/CopperSkins'
import { Icon } from './Icon'
import { openModal, useUi } from '../state/ui'
import type { ScreenId } from '../state/ui'
import { useAccounts, getAccount } from '../state/accounts'
import '../styles/copper.css'
export function HubTopTabs({ libLabel = 'Инстансы' }: { libLabel?: string }) { return <span className="tb-tabs">{libLabel}</span> }
export function Sidebar({ onNav }: { onNav: (s: ScreenId) => void }) {
  const [skinsOpen, setSkinsOpen] = useState(false)
  const screen = useUi((s) => s.screen)
  useAccounts()
  const account = getAccount()
  return <header className="topbar copper-nav"><nav aria-label="Разделы лаунчера">
    {([{ id: 'play', label: 'Быстрый старт', icon: 'i-play' }, { id: 'builds', label: 'Инстансы', icon: 'i-folder' }, { id: 'mods', label: 'Каталог', icon: 'i-download' }] as const).map((item) =>
      <button key={item.id} aria-current={screen === item.id ? 'page' : undefined} className={'btn md ' + (screen === item.id ? 'primary' : 'secondary')} onClick={() => onNav(item.id)}><Icon id={item.icon} />{item.label}</button>)}
    </nav><div className="copper-nav-actions"><button className="btn md secondary" onClick={() => openModal('accModal')}><Icon id="i-mo-user" />{account?.nick || 'Аккаунты'}</button>
    <button className="btn md secondary" onClick={() => setSkinsOpen(true)}><Icon id="i-creeper-face" />Скины</button>
    <button className="btn md secondary" onClick={() => onNav('settings')} aria-label="Настройки"><Icon id="i-settings" /></button></div>{skinsOpen && <CopperSkins onClose={() => setSkinsOpen(false)} />}</header>
}
