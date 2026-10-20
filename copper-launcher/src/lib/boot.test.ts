import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

test('заставка в index.html непрозрачна на весь экран — снимать её обязательно', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
  const rule = /#boot\{([^}]*)\}/.exec(html)?.[1] ?? ''
  expect(rule).toContain('top:0;right:0;bottom:0;left:0')
  expect(rule, 'WebKit of Safari 13 (macOS 10.13) drops `inset` and paints the splash in the corner').not.toContain('inset')
  expect(rule).toMatch(/background:#[0-9a-f]{3,6}/i)
})
