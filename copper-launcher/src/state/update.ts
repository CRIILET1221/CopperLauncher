import { create } from 'zustand'

interface UpdateState {
  /** Версия, которая вышла на GitHub; null — обновления нет. */
  version: string | null
  notes: string
  /** Страница релиза для ручной установки. */
  page: string
  busy: boolean
  /** Ход скачивания установщика, 0..100; null — не качаем. */
  pct: number | null
  /** «Позже»: плашка скрыта до следующего запуска. */
  hidden: boolean
  set: (p: Partial<UpdateState>) => void
}

export const useUpdate = create<UpdateState>((set) => ({
  version: null,
  notes: '',
  page: '',
  busy: false,
  pct: null,
  hidden: false,
  set: (p) => set(p),
}))
