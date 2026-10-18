import { Icon } from './Icon'
import { useUpdate } from '../state/update'
import { applyUpdate, postponeUpdate } from '../lib/updater'

export function UpdateBanner() {
  const version = useUpdate((s) => s.version)
  const hidden = useUpdate((s) => s.hidden)
  const busy = useUpdate((s) => s.busy)
  const pct = useUpdate((s) => s.pct)
  if (!version || hidden) return null

  const label = busy
    ? pct !== null && pct >= 100
      ? 'Ставим ' + version + ' — лаунчер перезапустится'
      : 'Качаем обновление ' + version + (pct ? ' · ' + pct + '%' : '')
    : 'Вышла версия ' + version

  return (
    <div className="upd-banner" role="status">
      <Icon id="i-download" />
      <span className="upd-banner-txt">{label}</span>
      {busy ? (
        <span className="spin" style={{ width: '14px', height: '14px' }}></span>
      ) : (
        <>
          <button className="btn sm ghost" onClick={postponeUpdate}>
            Позже
          </button>
          <button className="btn sm primary" onClick={() => void applyUpdate()}>
            <Icon id="i-restart" />
            Обновить
          </button>
        </>
      )}
    </div>
  )
}
