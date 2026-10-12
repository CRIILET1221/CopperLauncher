const MIN_VISIBLE_MS = 520

let startedAt = typeof performance !== 'undefined' ? performance.now() : 0
let hidden = false
let windowReady: Promise<void> = Promise.resolve()

export function showBootWindow(show: () => Promise<void>): Promise<void> {
  windowReady = (async () => {
    const image = document.querySelector<HTMLImageElement>('#boot img')
    if (image) await Promise.race([
      image.decode().catch(() => {}),
      new Promise<void>(resolve => setTimeout(resolve, 1500)),
    ])
    // Hidden WebViews can pause animation frames, so bound the frame wait.
    await new Promise<void>(resolve => {
      const timer = setTimeout(resolve, 180)
      requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(timer); resolve() }))
    })
    await show()
    startedAt = performance.now()
  })()
  return windowReady
}

export function hideBoot() {
  if (hidden) return
  hidden = true
  const el = document.getElementById('boot')
  if (!el) return
  void windowReady.then(() => {
    const elapsed = (typeof performance !== 'undefined' ? performance.now() : MIN_VISIBLE_MS) - startedAt
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed)
    setTimeout(() => {
      el.classList.add('gone')
      setTimeout(() => el.remove(), 400)
    }, wait)
  })
}

/// The splash is a full-screen opaque layer in `index.html`. Only the main
/// window ever hides it, so any other window that loads the same bundle - the
/// overlay - has to drop it before it paints over the whole screen.
export function dropBootSplash(doc: Pick<Document, 'getElementById'>) {
  doc.getElementById('boot')?.remove()
}
