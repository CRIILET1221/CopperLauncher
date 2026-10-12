import { setWebviewLowMemory, takeWebviewFailure } from '../ipc/commands'
import { noteGpuProcessExit } from './gpuLite'
import { hasTauri } from '../ipc/tauri'
import { showToast } from '../state/ui'

let failure: ReturnType<typeof takeWebviewFailure> | null = null
let liteAfterFailure = false
/** Причину прошлой смерти окна забираем один раз и как можно раньше: сбой
 *  видеокарты должен выключить WebGL до того, как лобби его создаст. */
export function webviewFailure(): ReturnType<typeof takeWebviewFailure> {
  if (!failure) {
    const taken = hasTauri() ? takeWebviewFailure().catch(() => null) : Promise.resolve(null)
    failure = taken.then((f) => {
      if (f && f.kind === 'gpu') liteAfterFailure = noteGpuProcessExit()
      return f
    })
  }
  return failure
}

export async function reportWebviewFailure(): Promise<void> {
  if (!hasTauri()) return
  const f = await webviewFailure()
  if (!f) return
  ;
  if (f.reason === 'out_of_memory') {
    showToast('Машине не хватило памяти — окно лаунчера перезапустилось само. Уменьши память сборке или закрой лишние программы', 'error')
    return
  }
  if (f.kind === 'gpu' && liteAfterFailure) {
    showToast('Видеокарта сбросила окно — включили лёгкую графику без 3D', 'error')
    return
  }
  showToast('Окно лаунчера подвисло и перезапустилось само', 'error')
}

/// Called around the game, when the machine is tightest: out of sight the webview
/// gives its caches back instead of competing with the game for RAM.
export function setLauncherIdleMemory(on: boolean): void {
  if (!hasTauri()) return
  void setWebviewLowMemory(on).catch(() => {})
}
