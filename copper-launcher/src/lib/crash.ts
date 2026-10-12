import { hasTauri } from '../ipc/tauri'
import { readCrashes } from '../ipc/commands'
import { redactSecrets } from './errorReport'

export interface RecentIssue { at: number; kind: 'error' | 'crash'; text: string }
const issues: RecentIssue[] = []
function remember(kind: RecentIssue['kind'], text: string) {
  issues.push({ at: Date.now(), kind, text: redactSecrets(text).trim().slice(0, 300) })
  if (issues.length > 20) issues.shift()
}
export function recentIssues(): RecentIssue[] { return issues.slice() }
export async function reportError(where: string, err: unknown, _fatal = false): Promise<void> {
  const e = err instanceof Error ? err : new Error(String(err))
  remember('error', (where ? where + ': ' : '') + e.message)
}
export async function flushNativeCrashes(): Promise<void> {
  if (!hasTauri()) return
  try { for (const c of await readCrashes()) remember('crash', c.file + ': ' + c.message) } catch {}
}
export function installErrorHandlers() {
  window.addEventListener('error', e => { void reportError('window', e.error || e.message) })
  window.addEventListener('unhandledrejection', e => { void reportError('promise', e.reason) })
}
