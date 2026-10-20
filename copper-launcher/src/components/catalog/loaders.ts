// Подписи и значки загрузчиков Modrinth (значки лежат в public/mr-icons/loaders).

const MR_LOADERS = new Set([
  'babric', 'bta-babric', 'bukkit', 'bungeecord', 'canvas', 'datapack', 'fabric', 'folia', 'forge', 'geyser',
  'iris', 'java-agent', 'legacy-fabric', 'liteloader', 'minecraft', 'modloader', 'neoforge', 'nilloader',
  'optifine', 'ornithe', 'paper', 'purpur', 'quilt', 'rift', 'spigot', 'sponge', 'vanilla', 'velocity', 'waterfall',
])
export const loaderIconSrc = (slug: string): string | null => (MR_LOADERS.has(slug) ? `/mr-icons/loaders/${slug}.svg` : null)

const LOADER_LABEL: Record<string, string> = {
  forge: 'Forge', fabric: 'Fabric', neoforge: 'NeoForge', quilt: 'Quilt', 'legacy-fabric': 'Legacy Fabric',
  ornithe: 'Ornithe', liteloader: 'LiteLoader', paper: 'Paper', folia: 'Folia', spigot: 'Spigot', bukkit: 'Bukkit',
  purpur: 'Purpur', sponge: 'Sponge', velocity: 'Velocity', bungeecord: 'BungeeCord', waterfall: 'Waterfall',
  datapack: 'Дата-пак', 'java-agent': 'Java Agent', optifine: 'OptiFine', iris: 'Iris', minecraft: 'Ванильная игра',
  rift: 'Rift', modloader: 'ModLoader', babric: 'Babric', canvas: 'canvas', vanilla: 'vanilla',
}
export const loaderLabel = (slug: string): string => LOADER_LABEL[slug] || slug

/** Число скачиваний по-русски: 12 тыс., 1,4 млн. */
export function fmtNum(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    const digits = m >= 100 ? 0 : 1
    return `${m.toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits })} млн`
  }
  if (n >= 10_000) return `${Math.round(n / 1000).toLocaleString('ru-RU')} тыс.`
  return n.toLocaleString('ru-RU')
}
