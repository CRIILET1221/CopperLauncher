import { hasTauri } from '../ipc/tauri'
import { openUrl } from '../ipc/commands'
export const MODRINTH_API = 'https://api.modrinth.com'
export function mirrorAsset(url: string | null | undefined) { return url || undefined }
export function openExt(url: string) { if (!/^https?:\/\//i.test(url)) return; if (hasTauri()) void openUrl(url); else window.open(url, '_blank', 'noopener') }
