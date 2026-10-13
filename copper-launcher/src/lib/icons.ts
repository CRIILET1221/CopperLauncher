export const BLOCK_ICONS: string[] = ["Block1Copper.svg", "Block2Copper.svg", "Block3Copper.svg", "Block4Copper.svg", "Block5Copper.svg", "Block6Copper.svg", "Block7Copper.svg", "Block8Copper.svg", "Block9Copper.svg", "Block10Copper.svg", "Block11Copper.svg", "Block12Copper.svg", "Block13Copper.svg", "Block14Copper.svg", "Block15Copper.svg", "Block16Copper.svg", "Block17Copper.svg", "Block18Copper.svg", "Block19Copper.svg", "Block20Copper.svg", "Block21Copper.svg", "Block22Copper.svg", "Block23Copper.svg", "Block24Copper.svg", "Block25Copper.svg", "Block26Copper.svg", "Block27Copper.svg", "Block28Copper.svg", "Block29Copper.svg", "Block30Copper.svg", "Block31Copper.svg", "Block32Copper.svg", "Block33Copper.svg", "Block34Copper.svg", "Block35Copper.svg", "Block36Copper.svg", "Block37Copper.svg", "Block38Copper.svg", "Block39Copper.svg", "Block40Copper.svg", "Block41Copper.svg", "Block42Copper.svg", "Block43Copper.svg", "Block44Copper.svg", "Block45Copper.svg", "Block46Copper.svg", "Block47Copper.svg", "Block48Copper.svg", "Block49Copper.svg", "Block50Copper.svg", "Block51Copper.svg", "Block52Copper.svg", "Block53Copper.svg", "Block54Copper.svg"].map(f=>'/block-icons/'+f);

// Keep saved instance recipes usable without retaining upstream artwork.
export function normalizeBundledIcon(src: string): string {
  src = src.replace(/(\/loaders\/(?:fabric|forge|neoforge))\.png(?=$|#)/i, "$1.svg")
  const legacy = /^\/build-icons\/mr\/([^/#]+)\.png(?=$|#)/.exec(src)
  if (legacy) {
    const names = ["grass-block","bookshelf","crafting-table","furnace","redstone-block","sticky-piston","slime-block","cake","campfire","pickaxe","sword","zombie","creeper","skeleton","ender-dragon","sculk-sensor","beacon","enchanting-table","lantern","tnt","command-block","poke-ball","orb","cooking-pot","skillet","terminal","globe","pancakes","backpack","couch","tiny-potato","blue-shark","brown-bear","moobloom","wrench","cogwheel","engine","tire","oxygen-distributor","space-helmet","gizmo"]
    const index = Math.max(0, names.indexOf(legacy[1])) + 1
    return src.replace(legacy[0], '/block-icons/Block' + index + 'Copper.svg')
  }
  if (src.startsWith('/build-icons/grass.png')) return src.replace('/build-icons/grass.png', '/block-icons/Block3Copper.svg')
  return src.replace(/(\/block-icons\/Block\d+)(?:Millida|Copper)\.png(?=$|#)/i, "$1Copper.svg")
}
