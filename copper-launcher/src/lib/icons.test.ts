import {expect,test} from 'bun:test'
import {existsSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {BLOCK_ICONS,normalizeBundledIcon} from './icons'

test('old Millida and Copper PNG paths migrate without losing the chosen background',()=>{
 for(const brand of ['Millida','Copper']) expect(normalizeBundledIcon(`/block-icons/Block52${brand}.png#bg=16304a`)).toBe('/block-icons/Block52Copper.svg#bg=16304a')
})
test('all selectable original SVGs exist, including migrated instance recipes',()=>{
 for(const src of [...BLOCK_ICONS,normalizeBundledIcon('/build-icons/mr/grass-block.png'),normalizeBundledIcon('/build-icons/grass.png')])expect(existsSync(fileURLToPath(new URL('../../public'+src,import.meta.url)))).toBe(true)
})
test('custom and remote icons are preserved',()=>{
 for(const src of ['data:image/png;base64,AAAA','https://example.com/custom.png','/my-own-icon.png'])expect(normalizeBundledIcon(src)).toBe(src)
})
