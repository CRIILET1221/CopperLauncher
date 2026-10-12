import { hasTauri } from '../ipc/tauri'
import { openUrl } from '../ipc/commands'
export const MODRINTH_API = 'https://api.modrinth.com'
export const LAUNCHER_API = ''
export const WALLET_URL = ''
export const PROFILE_URL = ''
export const PLUS_MANAGE_URL = ''
export const SUPPORT_URL = ''
export const SESSION_EXPIRED_EVENT = 'copper-session-expired'
export function mirrorAsset(url: string | null | undefined) { return url || undefined }
export function apiHeaders(): Record<string,string> { return { 'Content-Type': 'application/json' } }
export function hasCopperAccount() { return false }
export async function api<T = any>(_path: string, _opts?: RequestInit): Promise<T> { throw new Error('Сервис исходного лаунчера удалён из Copper') }
export function openExt(url: string) { if (!/^https?:\/\//i.test(url)) return; if (hasTauri()) void openUrl(url); else window.open(url, '_blank', 'noopener') }
