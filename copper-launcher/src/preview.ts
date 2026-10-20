// Предпросмотр в обычном браузере (только dev, в релиз не попадает):
// http://127.0.0.1:5173/?preview — демо-профиль интерфейса, чтобы увидеть экраны без Tauri-входа.
//
// http://127.0.0.1:5173/?preview=user — то же плюс демо-вход: лаунчер считает,
// что человек вошёл в аккаунт Microsoft, и экраны показывают залогиненный вид
// (флаг — src/lib/demo.ts). Всё под import.meta.env.DEV: в релизе ветки нет.
if (import.meta.env.DEV && !('__TAURI_INTERNALS__' in window) && new URLSearchParams(location.search).has('preview')) {
  const demo = new URLSearchParams(location.search).get('preview') === 'user'

  // Засеянную запись переписываем, чужую (заведённую руками) не трогаем:
  // так переключение ?preview ↔ ?preview=user работает в обе стороны.
  const seeded = demo
    ? [{ id: 'demo-user', nick: 'SlavaMine', kind: 'microsoft', uuid: '8f3c1a0e2b7d4e6a9c05d31f7a2b8e44' }]
    : [{ id: 'preview', nick: 'Steve', kind: 'preview' }]
  let current: { id?: string }[] = []
  try {
    const raw = JSON.parse(localStorage.getItem('m-accounts') || 'null')
    if (Array.isArray(raw)) current = raw
  } catch {}
  const ours = !current.length || current.every((a) => a && (a.id === 'preview' || a.id === 'demo-user'))
  if (ours) {
    localStorage.setItem('m-accounts', JSON.stringify(seeded))
    localStorage.setItem('m-active', seeded[0]!.id)
  }


  // Видно, что это не настоящий вход: маленькая неяркая плашка в углу.
  if (demo) {
    const mark = () => {
      if (document.getElementById('demo-mark')) return
      const el = document.createElement('div')
      el.id = 'demo-mark'
      el.textContent = 'Демо-вход'
      el.style.cssText = [
        'position:fixed',
        'right:10px',
        'bottom:10px',
        'z-index:2147483647',
        'pointer-events:none',
        'padding:4px 9px',
        'font:500 11px/1 ui-sans-serif,system-ui,sans-serif',
        'letter-spacing:.02em',
        'color:rgba(255,255,255,.62)',
        'background:rgba(18,18,20,.72)',
        'clip-path:polygon(5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%,0 5px)',
      ].join(';')
      document.body.appendChild(el)
    }
    if (document.body) mark()
    else document.addEventListener('DOMContentLoaded', mark, { once: true })
  }

  // `&open=settings` — сразу открыть экран (скриншоты без кликов).
  const open = new URLSearchParams(location.search).get('open')
  if (open) setTimeout(() => void import('./state/ui').then((m) => m.useUi.getState().setScreen(open as never)), 600)

  // `&launch=installing|running` и `&screen=…` — состояния запуска (src/lib/demoLaunch.ts).
  const launchDemo = new URLSearchParams(location.search).get('launch')
  if (launchDemo) {
    const screen = new URLSearchParams(location.search).get('screen')
    setTimeout(() => void import('./lib/demoLaunch').then((m) => m.installLaunchDemo(launchDemo, screen)), 800)
  }
}

// Тишина при разработке: VITE_NO_MUSIC=1 в .env.local выключает автозапуск
// плеера. Игрокам ничего не меняет — ветка есть только в dev.
if (import.meta.env.DEV && import.meta.env.VITE_NO_MUSIC === '1') {
  localStorage.setItem('m-mus-auto', '0')
}

export { }
