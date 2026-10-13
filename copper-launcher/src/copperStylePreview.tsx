import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { CopperInstancePicker } from './components/CopperInstancePicker'
import type { Profile } from './ipc/commands'
import './styles/01-base.css'
import './styles/02-kit.css'
import './styles/12-pixel.css'
import './styles/copper.css'
import './styles/copper-controls.css'

const profiles: Profile[] = [
  { name: 'Моя сборка', version: '1.21.1', loader: 'neoforge', fabric: false },
  { name: 'Чистая игра', version: '1.21.4', loader: 'vanilla', fabric: false },
  { name: 'Оптимизация', version: '1.20.1', loader: 'fabric', fabric: true },
  { name: 'Технические моды', version: '1.20.1', loader: 'forge', fabric: false },
]
function Preview() {
  const [selected, setSelected] = useState('Оптимизация')
  return <main style={{ maxWidth: 920, margin: '32px auto', padding: 24 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <img src="/copper-app-icon.png" width={64} height={64} style={{ imageRendering: 'pixelated' }} alt="Иконка C" />
      <h1 style={{ color: '#e08a63' }}>Copper Launcher</h1>
      {[32, 16].map((size) => <img key={size} src="/copper-app-icon.png" width={size} height={size} alt={`${size} px`} style={{ imageRendering: 'pixelated' }} />)}
    </div>
    <div className="copper-stage" style={{ minHeight: 480 }}>
      <img src="/copper-brand-v2.png" className="copper-emblem" alt="Медный куб остаётся в лаунчере" />
      <h1>Copper Launcher</h1>
      <div className="copper-launch">
        <CopperInstancePicker profiles={profiles} selected={selected} disabled={false} onSelect={setSelected} />
        <button className="btn primary copper-play">▶ Играть</button>
      </div>
      <button className="btn md secondary">Мои инстансы</button>
    </div>
    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
      <button className="btn md primary">Установить</button>
      <button className="btn md secondary">Выбрать папку…</button>
      <button className="btn md primary" disabled>Применить</button>
      <button className="btn md danger">Удалить Copper</button>
    </div>
  </main>
}
createRoot(document.getElementById('root')!).render(<Preview />)
