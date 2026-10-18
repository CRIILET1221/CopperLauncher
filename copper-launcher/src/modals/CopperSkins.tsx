import { Icon } from '../components/Icon'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ensureMsAuth } from '../state/msLogin'
import { SkinPreview } from '../components/SkinPreview'
import { hasLicenseSession, useAccounts } from '../state/accounts'
import { openModal } from '../state/ui'
import { openMicrosoftAccount } from './AccountAdd'
import { monogramAvatar, onAvatarError } from '../lib/format'
import { msUploadSkin, msResetSkin, msProfile, readSkinPng } from '../ipc/commands'
import { hasTauri } from '../ipc/tauri'
import { listenDragDrop, listenDragState } from '../ipc/events'
import type { UnlistenFn } from '../ipc/tauri'
import { decodeLocalSkin, readSkinLibrary, writeSkinLibrary, type SavedSkin } from '../lib/localSkins'
import '../styles/copper-skins.css'

/// Только официальный адрес текстур Minecraft: ссылка попадает в CSS `url()`.
const SKIN_URL = /^https:\/\/textures\.minecraft\.net\/texture\/[0-9a-f]+$/

/// Окно «Профиль»: аккаунт, которым играешь, его скин и управление аккаунтами.
/// Открывается кнопкой с ником в верхней панели, когда вход уже выполнен.
export function CopperSkins({ onClose }: { onClose: () => void }) {
  const accounts = useAccounts(s => s.list)
  const active = useAccounts(s => s.active)
  // Профиль показывает активный аккаунт; скин применяется к нему же.
  const current = accounts.find(a => a.id === active) || accounts.find(a => a.kind === 'microsoft') || accounts[0]
  const account = current && current.kind === 'microsoft' ? current.id : ''
  const others = accounts.filter(a => a.id !== current?.id)
  const online = !!current && hasLicenseSession(current)
  const [skinUrl, setSkinUrl] = useState('')
  const [confirmOut, setConfirmOut] = useState(false)
  // Аватар — лицо текущего скина аккаунта Microsoft. Ссылку на скин отдаёт
  // профиль Minecraft; лицо вырезается из неё в CSS (.copper-profile-face.skin).
  // Пока ссылки нет (или вход истёк), показывается заглушка с буквой ника.
  useEffect(() => {
    setSkinUrl('')
    if (!hasTauri() || !current || current.kind !== 'microsoft' || !online) return
    let alive = true
    void msProfile(current.id).then(p => { if (alive && p.skin && SKIN_URL.test(p.skin)) setSkinUrl(p.skin) }).catch(() => {})
    return () => { alive = false }
  }, [current?.id, online])
  useEffect(() => {
    if (!confirmOut) return
    const t = setTimeout(() => setConfirmOut(false), 4000)
    return () => clearTimeout(t)
  }, [confirmOut])
  const fileInput = useRef<HTMLInputElement>(null)
  const [filename, setFilename] = useState('')
  const [skin, setSkin] = useState('')
  const [slim, setSlim] = useState(false)
  const [busy, setBusy] = useState(false)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState('')
  const [library, setLibrary] = useState(readSkinLibrary)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [dragging, setDragging] = useState(false)
  const busyRef = useRef(false), importingRef = useRef(false), mounted = useRef(true)
  busyRef.current = busy
  const disabled = busy || importing
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  // Окно закрывается с той же анимацией, что и остальные окна: сначала класс
  // `closing` проигрывает исчезновение (copper-skins.css), потом окно убирается.
  const [closing, setClosing] = useState(false)
  const close = useCallback(() => {
    if (closing) return
    setClosing(true)
    setTimeout(onClose, 200)
  }, [closing, onClose])
  // Окно входа открывается, когда профиль уже убрался, чтобы окна не накладывались.
  const addAccount = () => { close(); setTimeout(() => openModal('accModal'), 210) }
  const relogin = () => { close(); setTimeout(openMicrosoftAccount, 210) }
  const switchTo = (id: string) => { useAccounts.getState().setActive(id); setMessage(''); setConfirmOut(false) }
  // Выход в два нажатия: первое спрашивает «Точно выйти?», второе выходит.
  const signOut = () => {
    if (!current) return
    if (!confirmOut) { setConfirmOut(true); return }
    setConfirmOut(false)
    useAccounts.getState().remove(current.id)
    if (!useAccounts.getState().list.length) close()
  }
  const selectSkin = (item: SavedSkin) => {
    setSkin(item.png); setFilename(item.name); setSlim(item.slim); setSelectedId(item.id); setLibraryOpen(false); setMessage('')
  }
  const importData = useCallback(async (data: string, name: string) => {
    if (busyRef.current || importingRef.current) return
    importingRef.current = true; setImporting(true); setMessage('')
    try {
      const decoded = await decodeLocalSkin(data, name)
      if (!mounted.current) return
      const existing = readSkinLibrary(), duplicate = existing.find(s => s.png === decoded.png)
      const item: SavedSkin = duplicate || { ...decoded, id: crypto.randomUUID() }
      setSkin(item.png); setFilename(item.name); setSlim(item.slim); setSelectedId(item.id); setLibraryOpen(false)
      try { const next = duplicate ? existing : [item, ...existing]; writeSkinLibrary(next); setLibrary(next) }
      catch(e) { setSelectedId(''); setMessage('Скин открыт, но не сохранён: ' + String(e)) }
    } catch(e) { if (mounted.current) setMessage(String(e)) }
    finally { importingRef.current = false; if (mounted.current) setImporting(false) }
  }, [])
  const importFile = async (file?: File) => {
    if (!file || disabled) return
    if (!/\.png$/i.test(file.name) || file.size > 1024 * 1024) { setMessage('Нужен PNG не больше 1 МБ.'); return }
    try {
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Не удалось прочитать файл.')); reader.readAsDataURL(file) })
      await importData(data, file.name)
    } catch(e) { if (mounted.current) setMessage(String(e)) }
  }
  useEffect(() => {
    let alive = true; const stops: UnlistenFn[] = []
    const keep = (stop: UnlistenFn | null) => { if (stop) { if (alive) stops.push(stop); else stop() } }
    void listenDragState(value => { if (alive) setDragging(value) }).then(keep)
    void listenDragDrop(paths => {
      if (!alive || busyRef.current || importingRef.current || !paths.length) return
      setDragging(false)
      const path = paths[0]
      if (!/\.png$/i.test(path)) { setMessage('Перетащи PNG скина.'); return }
      void readSkinPng(path).then(data => { if (alive) return importData(data, path.split(/[\\/]/).pop() || 'Скин.png') }).catch(e => { if (alive) setMessage(String(e)) })
    }).then(keep)
    return () => { alive = false; stops.forEach(stop => stop()) }
  }, [importData])
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopImmediatePropagation(); event.preventDefault(); if (!disabled) { if (libraryOpen) setLibraryOpen(false); else close() } } }
    document.addEventListener('keydown', key, true); return () => document.removeEventListener('keydown', key, true)
  }, [disabled, libraryOpen, close])
  const changeModel = (next: boolean) => {
    setSlim(next)
    if (!selectedId) return
    const updated = library.map(s => s.id === selectedId ? { ...s, slim: next } : s)
    try { writeSkinLibrary(updated); setLibrary(updated) } catch(e) { setMessage('Модель не сохранилась: ' + String(e)) }
  }
  const removeSaved = (id: string) => {
    const updated = library.filter(s => s.id !== id)
    try { writeSkinLibrary(updated); setLibrary(updated); if (id === selectedId) setSelectedId('') } catch(e) { setMessage(String(e)) }
  }
  const run = async (reset: boolean) => {
    if (!hasTauri()) { setMessage('Применение скина доступно в приложении.'); return }
    setBusy(true); setMessage('')
    try {
      const selectedAccount = useAccounts.getState().list.find(a => a.id === account && a.kind === 'microsoft')
      if (!selectedAccount) throw new Error('Выбери аккаунт Microsoft.')
      if (!await ensureMsAuth(selectedAccount)) throw new Error('Сессия Microsoft истекла. Войди в аккаунт заново.')
      if (reset) {
        await msResetSkin(account)
        void msProfile(account).then(p => setSkinUrl(p.skin && SKIN_URL.test(p.skin) ? p.skin : '')).catch(() => {})
        setMessage('Скин сброшен. Перезапусти Minecraft.')
      } else {
        const uploaded = await msUploadSkin(account, skin.split(',')[1], slim)
        const profile = await msProfile(account)
        if (!uploaded.skin || profile.skin !== uploaded.skin || profile.slim !== slim) {
          throw new Error('Minecraft пока не подтвердил выбранный скин. Попробуй ещё раз через несколько секунд.')
        }
        const accounts = useAccounts.getState()
        accounts.save(accounts.list.map(a => a.id === account ? { ...a, nick: profile.nick, uuid: profile.uuid, avatar: undefined, avatarFrom: undefined } : a))
        accounts.setActive(account)
        if (profile.skin && SKIN_URL.test(profile.skin)) setSkinUrl(profile.skin)
        setMessage('Скин подтверждён для ' + profile.nick + '. Этот аккаунт выбран для запуска. Полностью закрой Minecraft и запусти его снова.')
      }
    } catch(e) { setMessage(String(e)) } finally { setBusy(false) }
  }

  return createPortal(<div className={'copper-skins-backdrop' + (closing ? ' closing' : '')} data-copper-skins onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true) }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false) }} onDrop={e => { e.preventDefault(); setDragging(false); void importFile(e.dataTransfer.files[0]) }}>
    <div className={'copper-skins' + (dragging ? ' dragging' : '')} role="dialog" aria-modal="true" aria-label="Профиль">
      <header className="copper-skins-head"><b>Профиль</b><div className="copper-skins-head-actions">
        <button className="btn md secondary" disabled={disabled} aria-expanded={libraryOpen} aria-controls="copper-skin-library" onClick={() => setLibraryOpen(!libraryOpen)}><Icon id="i-image" />Мои скины · {library.length}</button>
        <button className="btn sm secondary" aria-label="Закрыть" disabled={disabled} onClick={close}><Icon id="i-x" /></button>
      </div></header>
      {current && <section className="copper-profile" aria-label="Аккаунт">
        {skinUrl
          ? <span className="copper-profile-face skin" role="img" aria-label={'Голова скина ' + current.nick} style={{ backgroundImage: `url("${skinUrl}")` }}><span style={{ backgroundImage: `url("${skinUrl}")` }} /></span>
          : <img className="copper-profile-face" src={current.avatar || monogramAvatar(current.nick, 48)} alt="" width={48} height={48} onError={e => onAvatarError(e, 48, current.nick)} />}
        <div className="copper-profile-info">
          <b title={current.nick}>{current.nick}</b>
          <span className={'copper-profile-status' + (online ? ' ok' : ' warn')}>{current.kind === 'microsoft' ? 'Лицензия Microsoft' : 'Аккаунт'} · {online ? 'вход выполнен' : 'нужно войти заново'}</span>
        </div>
        {!online && current.kind === 'microsoft' && <button className="btn sm primary" disabled={disabled} onClick={relogin}><Icon id="i-refresh" />Войти заново</button>}
      </section>}
      {others.length > 0 && <div className="copper-profile-switch"><span>Другие аккаунты</span>{others.map(a => <button key={a.id} className="btn sm secondary" disabled={disabled} onClick={() => switchTo(a.id)}><Icon id="i-mo-user" />{a.nick}</button>)}</div>}
      <p className="copper-profile-cap">Скин</p>
      {libraryOpen && <section id="copper-skin-library" className="copper-skin-library" aria-label="Сохранённые скины">
        <div className="copper-skin-library-title"><b>Сохранено на этом устройстве</b><button className="btn sm secondary" aria-label="Закрыть коллекцию" disabled={disabled} onClick={() => setLibraryOpen(false)}><Icon id="i-x" /></button></div>
        {library.length ? <div className="copper-skin-grid">{library.map(item => <div key={item.id} className={'copper-skin-tile' + (selectedId === item.id ? ' selected' : '')}>
          <button className="copper-skin-pick" disabled={disabled} onClick={() => selectSkin(item)} title={item.name}><img src={item.face} alt="" /><span>{item.name}</span></button>
          <button className="copper-skin-delete" disabled={disabled} aria-label={'Удалить сохранённый скин ' + item.name} onClick={() => removeSaved(item.id)}><Icon id="i-x" /></button>
        </div>)}</div> : <p className="copper-skins-hint">Перетащи PNG или выбери файл — скин автоматически сохранится здесь.</p>}
      </section>}
      <div className="copper-skins-layout">
        <div className="copper-skin-view">
          {skin ? <SkinPreview src={skin} slim={slim} /> : <button className="copper-skin-empty" disabled={disabled} onClick={() => fileInput.current?.click()}><Icon id="i-plus" style={{width:40,height:40}} /><b>Перетащи скин сюда</b><small>или нажми, чтобы выбрать PNG</small></button>}
          {dragging && <div className="copper-skin-drop-hint">Отпусти PNG, чтобы сохранить скин</div>}
        </div>
        <div className="copper-skins-settings">
          <p className="copper-skins-hint">PNG 64×64 или 64×32 · сохраняется локально</p>
          <div className="copper-skin-file"><button className="btn md secondary" disabled={disabled} onClick={() => fileInput.current?.click()}>{importing ? 'Открываем…' : 'Выбрать PNG'}</button><span title={filename}>{filename || 'Файл не выбран'}</span></div>
          <input ref={fileInput} hidden type="file" accept="image/png" disabled={disabled} aria-label="Выбрать скин" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void importFile(file) }} />
          <label className="copper-skins-field"><span>Модель персонажа</span><select aria-label="Модель персонажа" value={slim ? 'slim' : 'classic'} disabled={disabled} onChange={e => changeModel(e.target.value === 'slim')}><option value="classic">Classic — широкие руки</option><option value="slim">Slim — узкие руки</option></select></label>
          {!account && <p className="copper-skins-hint">Чтобы применить скин в игре, нужен вход в аккаунт Microsoft.</p>}
          {message && <p className="copper-skin-message" role="status">{message}</p>}
          <div className="copper-skins-actions"><button className="btn md secondary" disabled={!account || disabled} onClick={() => void run(true)}><Icon id="i-refresh" />Сбросить</button><button className="btn md primary" disabled={!account || !skin || disabled} onClick={() => void run(false)}><Icon id="i-check" />{busy ? 'Применяем…' : 'Применить'}</button></div>
        </div>
      </div>
      <footer className="copper-profile-foot">
        <button className="btn md secondary" disabled={disabled} onClick={addAccount}><Icon id="i-plus" />Добавить аккаунт</button>
        {current && <button className={'btn md ' + (confirmOut ? 'danger' : 'secondary')} disabled={disabled} onClick={signOut}><Icon id="i-logout" />{confirmOut ? 'Точно выйти?' : 'Выйти'}</button>}
      </footer>
    </div>
  </div>, document.body)
}
