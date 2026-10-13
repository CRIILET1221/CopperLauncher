// Keep a fast click perceptible without delaying the button's action.
(() => {
  const pressed = new Map()
  const timers = new Map()
  const buttonFor = (target) => {
    const button = target instanceof Element ? target.closest('.btn') : null
    return button && !button.matches(':disabled,[aria-disabled="true"]') ? button : null
  }
  const press = (button) => {
    if (!button || pressed.has(button)) return
    clearTimeout(timers.get(button))
    button.setAttribute('data-copper-pressed', '')
    pressed.set(button, performance.now())
  }
  const release = () => {
    for (const [button, time] of pressed) {
      pressed.delete(button)
      timers.set(button, setTimeout(() => {
        button.removeAttribute('data-copper-pressed')
        timers.delete(button)
      }, Math.max(0, 130 - (performance.now() - time))))
    }
  }
  document.addEventListener('pointerdown', (event) => { if (event.button === 0) press(buttonFor(event.target)) }, true)
  document.addEventListener('pointerup', release, true)
  document.addEventListener('pointercancel', release, true)
  document.addEventListener('keydown', (event) => {
    if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) press(buttonFor(event.target))
  }, true)
  document.addEventListener('keyup', (event) => { if (event.key === 'Enter' || event.key === ' ') release() }, true)
  window.addEventListener('blur', release)
})()
