export const BLOCK_ICONS: string[] = ["Block1Copper.svg", "Block2Copper.svg", "Block3Copper.svg", "Block4Copper.svg", "Block5Copper.svg", "Block6Copper.svg", "Block7Copper.svg", "Block8Copper.svg", "Block9Copper.svg", "Block10Copper.svg", "Block11Copper.svg", "Block12Copper.svg", "Block13Copper.svg", "Block14Copper.svg", "Block15Copper.svg", "Block16Copper.svg", "Block17Copper.svg", "Block18Copper.svg", "Block19Copper.svg", "Block20Copper.svg", "Block21Copper.svg", "Block22Copper.svg", "Block23Copper.svg", "Block24Copper.svg", "Block25Copper.svg", "Block26Copper.svg", "Block27Copper.svg", "Block28Copper.svg", "Block29Copper.svg", "Block30Copper.svg", "Block31Copper.svg", "Block32Copper.svg", "Block33Copper.svg", "Block34Copper.svg", "Block35Copper.svg", "Block36Copper.svg", "Block37Copper.svg", "Block38Copper.svg", "Block39Copper.svg", "Block40Copper.svg", "Block41Copper.svg", "Block42Copper.svg", "Block43Copper.svg", "Block44Copper.svg", "Block45Copper.svg", "Block46Copper.svg", "Block47Copper.svg", "Block48Copper.svg", "Block49Copper.svg", "Block50Copper.svg", "Block51Copper.svg", "Block52Copper.svg", "Block53Copper.svg", "Block54Copper.svg"].map(f=>'/block-icons/'+f);

// Restore library artwork while preserving saved background recipes.
const RESTORED_SYMBOLS = ["grass-block","bookshelf","crafting-table","furnace","redstone-block","sticky-piston","slime-block","cake","campfire","pickaxe","sword","zombie","creeper","skeleton","ender-dragon","sculk-sensor","beacon","enchanting-table","lantern","tnt","command-block","poke-ball","orb","cooking-pot","skillet","terminal","globe","pancakes","backpack","couch","tiny-potato","blue-shark","brown-bear","moobloom","wrench","cogwheel","engine","tire","oxygen-distributor","space-helmet","gizmo"]
export const INSTANCE_ICONS = RESTORED_SYMBOLS.map((name) => '/build-icons/mr/' + name + '.png')
export function normalizeBundledIcon(src: string): string {
  src = src.replace(/(\/loaders\/(?:vanilla|fabric|neoforge))\.svg(?=$|#)/i, '$1.png')
  src = src.replace(/(\/loaders\/forge)\.png(?=$|#)/i, '$1.svg')
  src = src.replace(/(\/block-icons\/Block\d+)(?:Millida|Copper)\.png(?=$|#)/i, '$1Copper.svg')
  if (src.startsWith('/build-icons/grass.png')) return src.replace('/build-icons/grass.png', '/build-icons/mr/grass-block.png')
  const placeholder = /^\/block-icons\/Block(\d+)Copper\.svg(?=$|#)/.exec(src)
  if (placeholder) {
    const number = Number(placeholder[1])
    const name = number === 52 ? 'bookshelf' : RESTORED_SYMBOLS[number - 1]
    if (name) return src.replace(placeholder[0], '/build-icons/mr/' + name + '.png')
  }
  return src
}
