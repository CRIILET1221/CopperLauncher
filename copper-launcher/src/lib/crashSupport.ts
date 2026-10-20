import { listLogs, shareLog } from '../ipc/commands'
const LAUNCH_LOG = 'logs/launcher-latest.log'
const GAME_LOG = 'logs/latest.log'

export async function shareCrashLog(profile: string, crashLog?: string): Promise<string> {
  if (crashLog) return shareLog(profile, crashLog)
  const files = await listLogs(profile)
  const file =
    files.find((f) => f === LAUNCH_LOG) ??
    files.find((f) => f === GAME_LOG) ??
    files.find((f) => f.startsWith('logs/')) ??
    files[0]
  if (!file) throw new Error('Лога от этого запуска нет')
  return shareLog(profile, file)
}
