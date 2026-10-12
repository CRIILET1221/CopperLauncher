import { inferModelType, loadSkinToCanvas } from 'skinview-utils'

export interface SavedSkin { id: string; name: string; png: string; face: string; slim: boolean }
const KEY = 'copper-local-skins-v1'
const LIMIT = 64
const pngURL = (value: unknown): value is string => typeof value === 'string' && value.startsWith('data:image/png;base64,') && value.length < 40000
export function readSkinLibrary(): SavedSkin[] {
  try {
    const items: unknown = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (!Array.isArray(items)) return []
    return items.filter((s): s is SavedSkin => !!s && typeof s.id === 'string' && typeof s.name === 'string' && typeof s.slim === 'boolean' && pngURL(s.png) && pngURL(s.face)).slice(0, LIMIT)
  } catch { return [] }
}
export function writeSkinLibrary(skins: SavedSkin[]): void {
  if (skins.length > LIMIT) throw new Error('В коллекции уже 64 скина. Удали ненужный, чтобы добавить новый.')
  localStorage.setItem(KEY, JSON.stringify(skins))
}
export async function decodeLocalSkin(data: string, filename: string): Promise<Omit<SavedSkin, 'id'>> {
  if (!data.startsWith('data:image/png;base64,')) throw new Error('Выбери PNG скина.')
  const image = new Image()
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Не удалось открыть PNG.')); image.src = data })
  if (image.width !== 64 || ![32, 64].includes(image.height)) throw new Error('Нужен PNG размером 64×64 или 64×32.')
  // Re-encode the 64px texture to keep the local collection small and discard file metadata.
  const original = document.createElement('canvas'); original.width = 64; original.height = image.height
  original.getContext('2d')!.drawImage(image, 0, 0)
  const normalized = document.createElement('canvas'); loadSkinToCanvas(normalized, image)
  const face = document.createElement('canvas'); face.width = face.height = 8
  const context = face.getContext('2d')!
  context.drawImage(normalized, 8, 8, 8, 8, 0, 0, 8, 8)
  context.drawImage(normalized, 40, 8, 8, 8, 0, 0, 8, 8)
  return { name: filename.replace(/\.png$/i, '').slice(0, 80) || 'Скин', png: original.toDataURL('image/png'), face: face.toDataURL('image/png'), slim: image.height === 64 && inferModelType(normalized) === 'slim' }
}
