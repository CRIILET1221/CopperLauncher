import { beforeEach, describe, expect, mock, test } from 'bun:test'

let files: string[] = []
let shareImpl: (profile: string, name: string) => Promise<string> = async (_p, name) =>
  'https://mclo.gs/' + name

mock.module('../ipc/commands', () => ({
  listLogs: async () => files,
  shareLog: (profile: string, name: string) => shareImpl(profile, name),
}))

const { shareCrashLog } = await import('./crashSupport')

// Поддержке нужен лог ЗАПУСКА: в нём видно, на чём оборвалась установка. Игровой
// latest.log пишет уже сама игра, и при падении на старте его может не быть
// вовсе. Порядок предпочтений проверяется таблицей, потому что это единственное,
// что отличает полезное обращение от «у меня не работает».
const PICK: Array<[string[], string, string]> = [
  [
    ['logs/latest.log', 'logs/launcher-latest.log'],
    'logs/launcher-latest.log',
    'лог лаунчера важнее игрового, даже если лежит вторым',
  ],
  [['logs/latest.log', 'logs/2026-09-20-1.log.gz'], 'logs/latest.log', 'без лога лаунчера берём игровой'],
  [['logs/2026-09-20-1.log.gz'], 'logs/2026-09-20-1.log.gz', 'остались только архивы — отдаём архив'],
  [['crash-reports/hs_err.log'], 'crash-reports/hs_err.log', 'вне logs/ тоже лучше, чем ничего'],
]

describe('shareCrashLog', () => {
  beforeEach(() => {
    files = []
    shareImpl = async (_p, name) => 'https://mclo.gs/' + name
  })

  for (const [listing, picked, why] of PICK) {
    test(why, async () => {
      files = listing
      expect(await shareCrashLog('Выживание')).toBe('https://mclo.gs/' + picked)
    })
  }

  const SNAPSHOT: Array<[string[], string | undefined, string, string]> = [
    [
      ['logs/launcher-latest.log', 'logs/crash-1790000000-42.log'],
      'logs/crash-1790000000-42.log',
      'logs/crash-1790000000-42.log',
      'снимок вылета важнее лога лаунчера: тот уже мог принадлежать новому запуску',
    ],
    [
      ['logs/launcher-latest.log'],
      'logs/crash-1790000000-42.log',
      'logs/crash-1790000000-42.log',
      'снимок выгружается, даже если список логов ещё не успел его показать',
    ],
    [['logs/launcher-latest.log'], undefined, 'logs/launcher-latest.log', 'без снимка — прежний выбор'],
  ]
  for (const [listing, snapshot, picked, why] of SNAPSHOT) {
    test(why, async () => {
      files = listing
      expect(await shareCrashLog('Выживание', snapshot)).toBe('https://mclo.gs/' + picked)
    })
  }

  test('логов нет — ошибка, а не пустая ссылка', async () => {
    files = []
    expect(shareCrashLog('Выживание')).rejects.toThrow('Лога от этого запуска нет')
  })
})

