import fs from 'node:fs'
import path from 'node:path'
import { pxRects, pxSize } from '../src/components/pxArt'
const root = path.resolve(import.meta.dir, '..')
const names = ['x', 'check', 'play', 'folder', 'download', 'mo-trash', 'refresh']
fs.mkdirSync(path.join(root, 'public/pixel-icons'), { recursive: true })
let css = '.btn[data-pixel-icon]::after{content:"";display:inline-block;width:16px;height:16px;flex-shrink:0;order:-1;background:center/contain no-repeat;image-rendering:pixelated}.btn.primary[data-pixel-icon]::after{filter:brightness(.15)}\n'
for (const name of names) {
  const { w, h } = pxSize(name)
  const rects = pxRects(name).map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${r.fill === 'currentColor' ? '#e5e9df' : r.fill}"${r.op ? ` opacity="${r.op}"` : ''}/>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${rects}</svg>`
  fs.writeFileSync(path.join(root, `public/pixel-icons/${name}.svg`), svg)
  css += `.btn[data-pixel-icon="${name}"]::after{background-image:url("pixel-icons/${name}.svg")}\n`
  if (name === 'x') {
    for (const app of ['copper-installer', 'copper-uninstaller']) {
      const file = path.join(root, '..', app, 'ui/index.html')
      const html = fs.readFileSync(file, 'utf8').replace(/(<button class="copper-window-close"[^>]*>)<svg[\s\S]*?<\/svg>/, `$1${svg.replaceAll('#e5e9df', 'currentColor').replace('<svg ', '<svg width="16" height="16" aria-hidden="true" ')}`)
      fs.writeFileSync(file, html)
    }
  }
}
css += '.btn.primary[data-pixel-icon="folder"]::after{filter:none}\n'
fs.writeFileSync(path.join(root, 'public/pixel-buttons.css'), css)
for (const app of ['copper-installer', 'copper-uninstaller']) {
  fs.cpSync(path.join(root, 'public/pixel-icons'), path.join(root, '..', app, 'ui/pixel-icons'), { recursive: true })
  fs.copyFileSync(path.join(root, 'public/pixel-buttons.css'), path.join(root, '..', app, 'ui/pixel-buttons.css'))
}
