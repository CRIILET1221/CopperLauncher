import { Icon } from '../components/Icon'
import { useProfiles } from '../state/profiles'
import { useGame, stopRunningGame } from '../state/game'
import { openModal, setScreen, showToast, useUi } from '../state/ui'
import { hasTauri } from '../ipc/tauri'
import { realLaunch, cancelPrelaunch } from '../lib/launch'
import { playButtonState } from '../lib/launchView'
import '../styles/copper.css'
export function Play({ on }: { on: boolean }) {
  const { profiles, selected, setSelected } = useProfiles()
  const prelaunch = useUi((s) => s.prelaunch)
  const running = useGame((s) => s.list)
  const stopping = useGame((s) => s.stopping)
  const profile = profiles.find((p) => p.name === selected) || profiles[0] || null
  const button = playButtonState({ modeKind: profile ? 'build' : null, selected: profile?.name || null, running, prelaunch })
  const play = () => {
    if (button.kind === 'installing') return
    if (button.kind === 'stop') { void stopRunningGame(button.profile); return }
    if (!profile) { openModal('nbModal'); return }
    if (!hasTauri()) { showToast('Запуск Minecraft доступен в приложении', 'error'); return }
    setSelected(profile.name)
    realLaunch(profile.name)
  }
  return <section className={'screen copper-home' + (on ? ' on' : '')} id="s-play">
    <div className="copper-stage"><img src="/copper-brand-v2.png" className="copper-emblem" alt="" /><h1>Copper Launcher</h1>

    <div className="copper-launch">
      {profiles.length ? <select aria-label="Инстанс" id="copper-instance" value={profile?.name || ''} disabled={prelaunch.open} onChange={(e) => setSelected(e.target.value)}>
        {profiles.map((p) => <option key={p.name} value={p.name}>{p.name} · {p.version} · {p.loader || (p.fabric ? 'fabric' : 'vanilla')}</option>)}
      </select> : null}
      <button className="btn primary copper-play" disabled={button.kind === 'installing' || stopping} onClick={play}>
        <Icon id={button.kind === 'stop' ? 'i-power' : 'i-play'} />
        {button.kind === 'installing' ? button.stage + ' · ' + button.pct + '%' : button.kind === 'stop' ? (stopping ? 'Останавливаем…' : 'Остановить') : profile ? 'Играть' : 'Создать инстанс'}
      </button>
      {button.kind === 'installing' ? <button className="btn sm secondary" onClick={cancelPrelaunch}>Отменить запуск</button> : null}
    </div>
      <button className="btn md secondary" onClick={() => setScreen('builds')}><Icon id="i-folder" /> Мои инстансы</button>
    </div>
  </section>
}
