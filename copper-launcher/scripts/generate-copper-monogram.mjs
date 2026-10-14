// Editable vector artwork based on the maintainer's 16px monogram reference.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cells = new Set()
function rect(x, y, w, h) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) cells.add(`${i},${j}`)
}
rect(5, 4, 7, 2)
rect(4, 5, 2, 6)
rect(5, 10, 7, 2)
let glyph = ''
for (const cell of cells) {
  const [x, y] = cell.split(',').map(Number)
  const color = !cells.has(`${x},${y - 1}`) ? '#e08a63' : !cells.has(`${x},${y + 1}`) ? '#8a4630' : '#c0694a'
  glyph += `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"/>`
}
fs.writeFileSync(path.join(root, 'public/copper-monogram.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 16 16" shape-rendering="crispEdges"><title>Copper C monogram</title><path fill="#2a8a7a" d="M1 0h14v1h1v14h-1v1H1v-1H0V1h1z"/><path fill="#16241d" d="M1 1h14v14H1z"/>${glyph}</svg>\n`)
const cli = path.join(root, 'node_modules/@tauri-apps/cli/tauri.js')
const icons = path.join(root, 'src-tauri/icons')
const result = spawnSync(process.execPath, [cli, 'icon', path.join(root, 'public/copper-monogram.svg'), '-o', icons], { stdio: 'inherit' })
if (result.error || result.status !== 0) throw result.error || new Error('Icon generation failed')
for (const name of ['copper-app-icon.png', 'copper-logo.png']) {
  fs.copyFileSync(path.join(icons, 'icon.png'), path.join(root, 'public', name))
}
for (const app of ['copper-installer', 'copper-uninstaller']) {
  const sibling = path.join(root, '..', app)
  for (const name of ['icon.png', 'icon.ico']) fs.copyFileSync(path.join(icons, name), path.join(sibling, 'src-tauri/icons', name))
  for (const name of ['copper-app-icon.png', 'copper-logo.png']) fs.copyFileSync(path.join(root, 'public', name), path.join(sibling, 'ui', name))
  fs.copyFileSync(path.join(root, 'public/copper-app-icon.png'), path.join(sibling, 'ui/startup-logo.png'))
  fs.copyFileSync(path.join(root, 'src/styles/copper-controls.css'), path.join(sibling, 'ui/copper-controls.css'))
  fs.copyFileSync(path.join(root, 'public/copper-controls.js'), path.join(sibling, 'ui/copper-controls.js'))
}
console.log('Generated Copper monogram and all application icons; the copper cube is preserved.')
