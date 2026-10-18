// Ставит версию лаунчера сразу в package.json, tauri.conf.json и Cargo.toml.
// Автообновление сравнивает тег релиза (v2.0.3) именно с версией из Cargo.toml.
// Запуск: bun run set-version 2.0.3
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const version = (process.argv[2] || '').replace(/^v/i, '')
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error('Укажи версию вида 2.0.3: bun run set-version 2.0.3')
  process.exit(1)
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const edits = [
  ['package.json', /("version"\s*:\s*")[^"]+(")/],
  ['src-tauri/tauri.conf.json', /("version"\s*:\s*")[^"]+(")/],
  ['src-tauri/Cargo.toml', /^(version\s*=\s*")[^"]+(")/m],
]
for (const [file, re] of edits) {
  const path = join(root, file)
  const text = readFileSync(path, 'utf8')
  if (!re.test(text)) {
    console.error('Не нашёл версию в ' + file)
    process.exit(1)
  }
  writeFileSync(path, text.replace(re, `$1${version}$2`))
  console.log(file + ' → ' + version)
}
console.log('Готово. Дальше: bun run build:setup, затем релиз с тегом v' + version)
