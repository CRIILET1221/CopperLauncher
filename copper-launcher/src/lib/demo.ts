/**
 * ДЕМО-ВХОД — ТОЛЬКО ДЛЯ ПРОСМОТРА В БРАУЗЕРЕ (dev).
 *
 * Включается адресом `http://127.0.0.1:5173/?preview=user` и живёт целиком
 * внутри `import.meta.env.DEV`: в релизной сборке ветка вырезается, а сам флаг
 * без параметра `preview=user` остаётся false даже в dev.
 *
 * Зачем: без приложения (Tauri) нет ни аккаунта, ни сборок — по флагу экраны
 * показывают вид вошедшего игрока на демо-данных (см. src/preview.ts).
 */

const demoParam = (): boolean => {
  try {
    if (typeof window === 'undefined' || typeof location === 'undefined') return false
    if ('__TAURI_INTERNALS__' in window) return false
    return new URLSearchParams(location.search).get('preview') === 'user'
  } catch {
    return false
  }
}

/** Демо-вход включён. В релизе всегда false: `import.meta.env.DEV` там константа. */
export const DEMO_USER: boolean = !!import.meta.env.DEV && demoParam()
