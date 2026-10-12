import { useEffect, useRef, useState } from 'react'
import type { SkinScene } from '../lib/skinPreviewScene'

export function SkinPreview({ src, slim }: { src: string; slim: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const scene = useRef<SkinScene | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  useEffect(() => {
    let cancelled = false, current: SkinScene | null = null
    const controller = new AbortController()
    const target = canvas.current!
    setStatus('loading')
    void import('../lib/skinPreviewScene').then(module => module.createSkinScene(target, src, slim, () => { if (!cancelled) setStatus('error') }, controller.signal))
      .then(result => {
        if (cancelled) { result.dispose(); return }
        current = result; scene.current = result; setStatus('ready')
      }).catch(() => { if (!cancelled) setStatus('error') })
    return () => { cancelled = true; controller.abort(); current?.dispose(); scene.current = null }
  }, [src, slim])
  return <div className="copper-skin-preview">
    <canvas ref={canvas} className="copper-skin-canvas" aria-label="3D-предпросмотр выбранного скина" hidden={status === 'error'} />
    {status === 'loading' && <p role="status">Загружаем 3D-превью…</p>}
    {status === 'error' && <><img src={src} alt="Текстура выбранного скина" /><p role="status">3D недоступно — показана текстура скина.</p></>}
    {status === 'ready' && <><span className="copper-skins-hint">Потяни мышью, чтобы повернуть · Колесо — масштаб</span><div className="copper-skin-controls">
      <button type="button" className="btn sm secondary" aria-label="Повернуть скин влево" onClick={() => scene.current?.rotate(-Math.PI / 4)}>↶</button>
      <button type="button" className="btn sm secondary" onClick={() => scene.current?.reset()}>Сбросить ракурс</button>
      <button type="button" className="btn sm secondary" aria-label="Повернуть скин вправо" onClick={() => scene.current?.rotate(Math.PI / 4)}>↷</button>
    </div></>}
  </div>
}
