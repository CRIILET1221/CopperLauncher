import type { ReactNode } from 'react'
import { useEffect,useState } from 'react'
import { ColorPicker } from '../components/ColorPicker'
import { Icon } from '../components/Icon'
import { Select } from '../components/Select'
import { Block,Group,Query,Row,Segs,Toggle } from '../components/SetKit'
import { SharedStore } from '../components/SharedStore'
import type { JavaInfo,JavaRuntime } from '../ipc/commands'
import {
appVersion,
cacheSize,
clearCache,
defaultJava,
discordClear,
downloadJavaRuntime,
javaMajors,
listJavaRuntimes,
openGameFolder,
openUrl,
pickGameDir,
pickJavaPath,
removeJavaRuntime,
setDefaultJava,
setGameDir
} from '../ipc/commands'
import { hasTauri } from '../ipc/tauri'
import { apiErrorText } from '../lib/apiError'
import { autostartOn,setAutostart } from '../lib/autostart'
import { discordPresence } from '../lib/launch'
import { writePref } from '../lib/prefs'
import { betaChannel,checkForUpdate,pendingUpdate } from '../lib/updater'
import { useAccounts } from '../state/accounts'
import { uiConfirm } from '../state/confirm'
import { useLayout,type Layout } from '../state/layout'
import { useMcVersionList } from '../state/mcVersionList'
import { refreshProfiles } from '../state/profiles'
import type { SettingsTab } from '../state/ui'
import { showToast,useUi } from '../state/ui'
import { useUpdate } from '../state/update'
// Наличие аккаунта берём из стора, а не вызовом hasCopperAccount(): вызов не
// реактивен, и вкладка «Приватность», открытая до готовности хранилища сессий
// (или до входа в аккаунт), навсегда застревала на «Нужен аккаунт Copper».
import type { Accent } from '../lib/accent'
import { accentFromHex,computeAccent,paintAccent,saveAccent,withColorFade } from '../lib/accent'
import { copyText } from '../lib/clipboard'
import { buildDiagnostics } from '../lib/diag'
import { DUO_INVITE_OPTIONS,type DuoInvites } from '../lib/duoEmotes'
import { loadPrivacy,usePrivacy } from '../lib/privacy'
import type { LaunchWindowMode } from '../lib/window'
import {
hasTray,
launchWindowMode,
restoreOnGameExit,
setLaunchWindowMode,
setRestoreOnGameExit,
setTrayClose,
trayCloseEnabled,
} from '../lib/window'
import { useHasCopper } from '../state/auth'
import { startTour } from '../state/tour'
import type { PerfMode } from '../state/viewPrefs'
import { TAB_MS_DEFAULT,useViewPrefs } from '../state/viewPrefs'

/* ============================================================
   НАСТРОЙКИ — упрощены 23.09.2026 по правкам владельца:
   «вместо тем — цвет кнопок», «не левая панель — сверху кнопки»,
   «настройки попроще».

   - Шесть вкладок сверху: Вид · Звук · Игра · Файлы · Аккаунт · Лаунчер.
     Уведомления — в «Звуке», приватность — в «Аккаунте», трей — в «Лаунчере».
   - Строка = название и управление. Пояснение — одна строка и только там,
     где без него непонятно, или живое число (размер кэша, версия Java).
   - Поиск по всем вкладкам сразу: строка сама решает, подходит ли она (Row → keys).
   ============================================================ */

const ACCENTS: (Accent & { name: string })[] = [
  { id: 'copper', name: 'Медь', c: '#C0694A', h: '#D9825C', s: 'rgba(192,105,74,.14)' },
  { id: 'green', name: 'Зелёный', c: '#5EC64D', h: '#70D55F', s: 'rgba(94,198,77,.13)' },
  { id: 'lime', name: 'Лайм', c: '#9BD628', h: '#ACE23F', s: 'rgba(155,214,40,.14)' },
  { id: 'teal', name: 'Бирюзовый', c: '#22C7A9', h: '#3ADBBD', s: 'rgba(34,199,169,.14)' },
  { id: 'cyan', name: 'Голубой', c: '#2CB6E8', h: '#48C6F2', s: 'rgba(44,182,232,.14)' },
  { id: 'blue', name: 'Синий', c: '#4C8DFF', h: '#639BFF', s: 'rgba(76,141,255,.14)' },
  { id: 'indigo', name: 'Индиго', c: '#6C6BFF', h: '#8180FF', s: 'rgba(108,107,255,.14)' },
  { id: 'purple', name: 'Фиолетовый', c: '#9B6BFF', h: '#AC80FF', s: 'rgba(155,107,255,.14)' },
  { id: 'pink', name: 'Розовый', c: '#FF6BAA', h: '#FF80B8', s: 'rgba(255,107,170,.14)' },
  { id: 'red', name: 'Красный', c: '#FF6B5E', h: '#FF8073', s: 'rgba(255,107,94,.14)' },
  { id: 'orange', name: 'Оранжевый', c: '#F5923B', h: '#FFA24F', s: 'rgba(245,146,59,.14)' },
  { id: 'yellow', name: 'Жёлтый', c: '#F5C93B', h: '#FFD65A', s: 'rgba(245,201,59,.14)' },
  // Больше готовых цветов (правка владельца 23.09.2026): «лучше больше цветов».
  ...(
    [
      ['emerald', 'Изумрудный', '#2BB673'],
      ['mint', 'Мятный', '#5FE0B0'],
      ['sky', 'Небесный', '#6FC3FF'],
      ['azure', 'Лазурный', '#3A6FE0'],
      ['lavender', 'Лавандовый', '#B79CFF'],
      ['magenta', 'Малиновый', '#E8457A'],
      ['coral', 'Коралловый', '#FF8A65'],
      ['amber', 'Янтарный', '#FFB020'],
      ['sand', 'Песочный', '#D8B26E'],
      ['silver', 'Серебряный', '#BFC7CF'],
    ] as const
  ).map(([id, name, hex]) => ({ ...accentFromHex(hex), id, name })),
]

function applyAccent(raw: Accent, settled = false) {
  const a = computeAccent(raw)
  paintAccent(a, settled)
  saveAccent(a)
}

function initialCustomHex(): string {
  try {
    const s = JSON.parse(localStorage.getItem('m-accent') || 'null')
    if (s && s.id === 'custom') return s.c
  } catch {}
  return '#5EC64D'
}

function initialAccent(): string {
  try {
    const s = JSON.parse(localStorage.getItem('m-accent') || 'null')
    if (s) return s.id
  } catch {}
  return 'copper'
}

type SecId = 'look' | 'game' | 'files' | 'account' | 'about'

const SECTIONS: { id: SecId; label: string }[] = [
  { id: 'look', label: 'Вид' },
  { id: 'game', label: 'Игра' },
  { id: 'files', label: 'Файлы' },
  { id: 'account', label: 'Аккаунт' },
  { id: 'about', label: 'Лаунчер' },
]

/// Старые адреса вкладок (openSettings('notify') и сохранённый m-set-tab)
/// ведут туда, куда переехало их содержимое.
const MOVED: Record<string, SecId> = { window: 'game', notify: 'game', sound: 'game', clips: 'game', privacy: 'account' }

function toSec(v: string | null | undefined): SecId | null {
  if (!v) return null
  if (MOVED[v]) return MOVED[v]
  return SECTIONS.some((s) => s.id === v) ? (v as SecId) : null
}

function initialSec(): SecId {
  try {
    return toSec(localStorage.getItem('m-set-tab')) || 'look'
  } catch {
    return 'look'
  }
}

/// Тумблеры приватности профиля. Те же поля правятся на copper.net —
/// подписи держим близкими к сайту, чтобы человек узнавал настройку.






export function Settings({ on }: { on: boolean }) {
  const [sec, setSecState] = useState<SecId>(initialSec)
  const [query, setQuery] = useState('')
  const wantTab = useUi((s) => s.settingsTab)
  const takeSettingsTab = useUi((s) => s.takeSettingsTab)
  const [accent, setAccent] = useState(initialAccent)
  const [customHex, setCustomHex] = useState(initialCustomHex)
  const [pickerOpen, setPickerOpen] = useState(false)
  
  const showSnapshots = useMcVersionList((s) => s.show)
  const [cacheMb, setCacheMb] = useState<number | null>(null)
  const [clearing, setClearing] = useState(false)
  const [moving, setMoving] = useState(false)
  const [winMode, setWinMode] = useState<LaunchWindowMode>(launchWindowMode)
  const [trayClose, setTrayCloseOn] = useState(trayCloseEnabled)
  const [backAfterGame, setBackAfterGame] = useState(restoreOnGameExit)
  const [tray, setTray] = useState(hasTray)
  const [autostart, setAutostartOn] = useState(true)
  
  const [discord, setDiscord] = useState(() => localStorage.getItem('m-discord') !== '0')
  
  
  
  
  const [ver, setVer] = useState('')
  const [diagBusy, setDiagBusy] = useState(false)
  const [diagText, setDiagText] = useState('')
  const [diagOpen, setDiagOpen] = useState(false)
  const [javas, setJavas] = useState<JavaRuntime[]>([])
  const [javaDef, setJavaDef] = useState<JavaInfo | null>(null)
  const [majors, setMajors] = useState<number[]>([8, 11, 17, 21])
  const [javaWant, setJavaWant] = useState(21)
  const [javaBusy, setJavaBusy] = useState(0)
  const [upd, setUpd] = useState(pendingUpdate)
  const [updBusy, setUpdBusy] = useState(false)
  const [beta, setBeta] = useState(betaChannel)
  const updStaged = useUpdate((s) => s.staged)
  const tabMs = useViewPrefs((s) => s.tabMs)
  const perf = useViewPrefs((s) => s.perf)
  const layout = useLayout((s) => s.layout)
  useAccounts()

  useEffect(() => {
    if (!on || !hasTauri()) return
    setTray(hasTray())
    setTrayCloseOn(trayCloseEnabled())
    void autostartOn().then(setAutostartOn)
    if (!ver) void appVersion().then(setVer).catch(() => {})
    if (cacheMb === null)
      void cacheSize()
        .then((b) => setCacheMb(Math.round(b / 1024 / 1024)))
        .catch(() => setCacheMb(0))
    void listJavaRuntimes().then(setJavas).catch(() => {})
    void defaultJava().then(setJavaDef).catch(() => {})
    void javaMajors()
      .then((m) => m.length && setMajors(m))
      .catch(() => {})
  }, [on])

  useEffect(() => {
    const want = toSec(wantTab as SettingsTab | null)
    if (!want) return
    setSec(want)
    takeSettingsTab()
  }, [wantTab])

  const setSec = (id: SecId) => {
    setSecState(id)
    setQuery('')
    try {
      localStorage.setItem('m-set-tab', id)
    } catch {}
    const c = document.querySelector('.content')
    if (c) c.scrollTop = 0
  }

  // Приватность серверная и общая с сайтом: при открытии раздела перечитываем
  // её, чтобы увидеть значение, выставленное на copper.net с другого места.
  const privacy = usePrivacy()
  const hasCopper = useHasCopper()
  useEffect(() => {
    if (!on || !hasCopper) return
    void loadPrivacy(true)
  }, [on, hasCopper])

  const pickDuoInvites = (value: DuoInvites) => {
    if (value === privacy.settings.duoInvites || privacy.saving === 'duoInvites') return
    privacy
      .patch({ duoInvites: value })
      .then(() => showToast('Эмоции вдвоём: ' + (DUO_INVITE_OPTIONS.find(([v]) => v === value)?.[1] ?? '').toLowerCase()))
      .catch(() => showToast('Не удалось сохранить настройку приглашений', 'error'))
  }



  const onlyApp = (what: string) => {
    if (hasTauri()) return false
    showToast(what + ' — в приложении лаунчера', 'error')
    return true
  }

  // Смена папки без переноса файлов означала «сделай все сборки заново»:
  // спрашиваем и по умолчанию переносим уже скачанное.
  const changeDir = async () => {
    if (onlyApp('Смена папки')) return
    try {
      const p = await pickGameDir()
      if (!p) return
      const move = await uiConfirm('Перенести в новую папку уже скачанные сборки, версии, миры и ассеты?', {
        confirmLabel: 'Перенести',
        cancelLabel: 'Оставить на месте',
        danger: false,
      })
      setMoving(true)
      showToast(move ? 'Переносим файлы игры…' : 'Меняем папку…')
      await setGameDir(p, move)
      await refreshProfiles()
      showToast(move ? 'Папка игры сменилась, файлы перенесены' : 'Папка игры сменилась')
    } catch (e) {
      console.error('[settings] game dir', e)
      showToast('Папка не сменилась', 'error')
    } finally {
      setMoving(false)
    }
  }


  /* ================= Вкладки ================= */

  const look = (
    <>
      <Block keys="цвет кнопок акцент цвет выделения палитра тема лаунчера plus diamond премиум">
        <Group title="Цвет кнопок">
          <div className="s2-swatches" id="accentSwatches" role="radiogroup" aria-label="Цвет кнопок">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                role="radio"
                aria-checked={a.id === accent}
                data-acc={a.id}
                aria-label={a.name}
                className={'s2-sw' + (a.id === accent ? ' on' : '')}
                style={{ background: a.c }}
                onClick={() => {
                  withColorFade(() => applyAccent(a, true))
                  setAccent(a.id)
                }}
              ></button>
            ))}
            
            <span className="s2-sw-wrap">
              <button
                aria-label="Свой цвет"
                className={'s2-sw custom' + (accent === 'custom' ? ' on' : '')}
                style={accent === 'custom' ? { background: customHex } : undefined}
                onClick={() => setPickerOpen((o) => !o)}
              >
                {accent === 'custom' ? null : <Icon id="i-plus" />}
              </button>
              {pickerOpen ? (
                <ColorPicker
                  value={customHex}
                  onClose={() => setPickerOpen(false)}
                  onChange={(hex) => {
                    setCustomHex(hex)
                    applyAccent(accentFromHex(hex))
                    setAccent('custom')
                  }}
                />
              ) : null}
            </span>
          </div>
        </Group>
        
      </Block>


      

      <Block keys="анимация движение персонаж танцует фон переход между вкладками скорость плавность оптимизация качество слабый пк производительность лаги fps">
        <Group title="Анимация">
          <Row title="Оптимизация" keys="оптимизация качество слабый пк производительность лаги fps плавность">
            <Segs<PerfMode>
              value={perf}
              options={[
                ['auto', 'Авто'],
                ['high', 'Полное'],
                ['low', 'Слабый ПК'],
              ]}
              onPick={(v) => useViewPrefs.getState().setPerf(v)}
            />
          </Row>
          <Row title="Переход между вкладками" keys="переход вкладки скорость длительность плавность анимация">
            <Segs<number>
              value={tabMs}
              options={[
                [0, 'Выкл'],
                [190, 'Быстро'],
                [TAB_MS_DEFAULT, 'Обычно'],
                [640, 'Медленно'],
              ]}
              onPick={(v) => useViewPrefs.getState().setTabMs(v)}
            />
          </Row>
        </Group>
      </Block>

      {/* В самом конце «Вида» (владелец 07.10.2026: «чтобы мало кто видел»). */}
      <Block keys="старый вид старая версия новая версия раскладка меню боковая панель классика лобби интерфейс">
        <Group title="Версия интерфейса">
          <Row title="Вид лаунчера" hint="Старый — разделы в панели слева" keys="старый вид новая версия раскладка боковая панель классика лобби">
            <Segs<Layout>
              value={layout}
              options={[
                ['lobby', 'Новый'],
                ['classic', 'Старый'],
              ]}
              onPick={(v) => useLayout.getState().set(v)}
            />
          </Row>
        </Group>
      </Block>
    </>
  )

  

  const game = (
    <>
      

      <Group title="Во время игры">
        <Row title="Лаунчер при запуске игры" keys="окно свернуть трей оставить">
          <Segs<LaunchWindowMode>
            value={winMode}
            options={[
              ['none', 'Оставить'],
              ['minimize', 'Свернуть'],
              ...(tray ? [['tray', 'В трей'] as [LaunchWindowMode, string]] : []),
            ]}
            onPick={(mode) => {
              setWinMode(mode)
              setLaunchWindowMode(mode)
            }}
          />
        </Row>
        <Row title="Вернуть лаунчер после игры" keys="окно развернуть">
          <Toggle
            label="Вернуть лаунчер после игры"
            on={backAfterGame}
            onChange={() => {
              const next = !backAfterGame
              setBackAfterGame(next)
              setRestoreOnGameExit(next)
            }}
          />
        </Row>
        
        <Row title="Снапшоты в списке версий" keys="версии тестовые снапшоты">
          <Toggle
            id="setSnapshots"
            label="Снапшоты в списке версий"
            on={showSnapshots}
            onChange={() => useMcVersionList.getState().setShow(!showSnapshots)}
          />
        </Row>
      </Group>
    </>
  )

  const files = (
    <>
      <Group title="Папка игры">
        <Row title="Папка игры" hint={moving ? 'Переносим — не закрывай лаунчер' : undefined} keys="директория путь сменить открыть">
          <button className="btn sm secondary" onClick={() => openGameFolder()} disabled={moving}>
            Открыть
          </button>
          <button className="btn sm secondary" onClick={() => void changeDir()} disabled={moving}>
            {moving ? 'Переносим…' : 'Сменить'}
          </button>
        </Row>
        <Row title="Кэш" hint={cacheMb === null ? undefined : cacheMb + ' МБ'} keys="временные файлы очистить место">
          <button
            className="btn sm secondary"
            disabled={clearing || !cacheMb}
            onClick={async () => {
              if (onlyApp('Очистка кэша')) return
              if (
                !(await uiConfirm('Очистить кэш и временные файлы? Сборки, миры и версии не тронем.', {
                  confirmLabel: 'Очистить',
                  danger: false,
                }))
              )
                return
              setClearing(true)
              clearCache()
                .then((freed) => {
                  showToast('Освобождено ' + Math.round(freed / 1024 / 1024) + ' МБ')
                  setCacheMb(0)
                })
                .catch((e) => {
                  console.error('[settings] cache', e)
                  showToast('Не удалось очистить', 'error')
                })
                .finally(() => setClearing(false))
            }}
          >
            {clearing ? 'Чистим…' : 'Очистить'}
          </button>
        </Row>
        <Block keys="общее хранилище моды дубли место">
          <SharedStore />
        </Block>
      </Group>

      <Group title="Java">
        <Row title="Java для всех сборок" hint={javaDef ? javaDef.version : 'Сама под каждую сборку'} keys="java джава путь авто">
          <button
            className="btn sm secondary"
            onClick={() => {
              if (onlyApp('Выбор Java')) return
              pickJavaPath()
                .then((j) => {
                  if (!j) return
                  return setDefaultJava(j.path).then(() => {
                    setJavaDef(j)
                    showToast('Java для всех сборок: ' + j.version)
                  })
                })
                .catch((e) => {
                  ;
                  showToast(apiErrorText(e, 'Не получилось — попробуй ещё раз'), 'error')
                })
            }}
          >
            Указать
          </button>
          {javaDef ? (
            <button
              className="btn sm ghost"
              onClick={() => {
                setDefaultJava(null)
                  .then(() => {
                    setJavaDef(null)
                    showToast('Java снова выбирается сама')
                  })
                  .catch((e) => {
                    ;
                    showToast(apiErrorText(e, 'Не получилось — попробуй ещё раз'), 'error')
                  })
              }}
            >
              Сбросить
            </button>
          ) : null}
        </Row>
        <Row title="Скачать Java" hint={javaBusy ? 'Качаем Java ' + javaBusy + '…' : undefined} keys="java установить">
          <Select
            value={String(javaWant)}
            options={majors.map((m) => ({ value: String(m), label: 'Java ' + m }))}
            onChange={(v) => setJavaWant(Number(v))}
            width={120}
          />
          <button
            className="btn sm secondary"
            disabled={!!javaBusy}
            onClick={() => {
              if (onlyApp('Скачивание Java')) return
              setJavaBusy(javaWant)
              downloadJavaRuntime(javaWant)
                .then((v) => {
                  showToast('Java готова: ' + v)
                  void listJavaRuntimes().then(setJavas).catch(() => {})
                })
                .catch((e) => {
                  ;
                  showToast(apiErrorText(e, 'Не получилось — попробуй ещё раз'), 'error')
                })
                .finally(() => setJavaBusy(0))
            }}
          >
            {javaBusy ? <span className="spin"></span> : null}
            {javaBusy ? 'Качаем…' : 'Скачать'}
          </button>
        </Row>
        {javas.map((j) => (
          <Row
            key={j.major}
            title={'Java ' + j.major}
            hint={Math.round(j.size / 1024 / 1024) + ' МБ · ' + (j.in_use ? 'нужна сборкам' : 'не используется')}
            keys="java установленная удалить"
          >
            <button
              className="btn sm ghost"
              aria-label={'Удалить Java ' + j.major}
              onClick={async () => {
                const question = j.in_use
                  ? 'Удалить Java ' + j.major + '? Она нужна установленным сборкам — лаунчер скачает её заново при их запуске.'
                  : 'Удалить Java ' + j.major + '? Если понадобится, лаунчер скачает её сам.'
                if (
                  !(await uiConfirm(question, {
                    confirmLabel: 'Удалить',
                    danger: true,
                  }))
                )
                  return
                removeJavaRuntime(j.major)
                  .then((freed) => {
                    showToast('Освобождено ' + Math.round(freed / 1024 / 1024) + ' МБ')
                    void listJavaRuntimes().then(setJavas).catch(() => {})
                  })
                  .catch((e) => {
                    console.error('[settings] java remove', e)
                    showToast(apiErrorText(e, 'Не удалось удалить'), 'error')
                  })
              }}
            >
              <Icon id="i-trash" />
            </button>
          </Row>
        ))}
      </Group>

      
    </>
  )

  const account = (
    <>
      

      

      {hasCopper ? (
        <Group title="Эмоции вдвоём">
          <Row title="Кто может звать" keys="эмоции вдвоём приглашение приватность друзья">
            {!privacy.loaded && privacy.loading ? (
              <span className="skel" style={{ width: '180px', height: '28px' }}></span>
            ) : (
              <Segs<DuoInvites> value={privacy.settings.duoInvites} options={DUO_INVITE_OPTIONS} onPick={pickDuoInvites} />
            )}
          </Row>
        </Group>
      ) : null}

      <Group title="Снаружи">
        <Row title="Активность в Discord" keys="дискорд статус rich presence приватность">
          <Toggle
            label="Активность в Discord"
            on={discord}
            onChange={() => {
              const next = !discord
              setDiscord(next)
              localStorage.setItem('m-discord', next ? '1' : '0')
              if (next) void discordPresence('lobby')
              else discordClear().catch(() => {})
            }}
          />
        </Row>
      </Group>
    </>
  )

  const about = (
    <>
      <Block keys="лицензия авторство официальный minecraft gpl">
        <p>Неофициальный лаунчер Minecraft. Не одобрен Mojang или Microsoft и не связан с ними.</p>
        <p>Copper Launcher — открытый проект под GPL-3.0-only. Автор: CRIILET1221.</p>
        <p>Авторские права на исходный код и лицензии сторонних компонентов — в файлах установки LICENSE, NOTICE и THIRD-PARTY.md.</p>
      </Block>
      <Block keys="версия обновление обновить проверить">
        <div className="s2-hero">
          <img src="/copper-brand-v2.png" alt="" width={48} height={48} />
          <span className="s2-hero-txt">
            <b>Copper Launcher</b>
            <small>
              {upd
                ? updStaged
                  ? 'Обновление ' + upd.version + ' встанет при выходе'
                  : 'Доступна ' + upd.version
                : ver
                  ? 'Версия ' + ver
                  : 'Версия приложения'}
            </small>
          </span>
          {upd ? (
            <button
              className="btn md primary"
              disabled={updBusy}
              onClick={() => {
                setUpdBusy(true)
                upd.install().catch((e) => {
                  console.error('[settings] update', e)
                  setUpdBusy(false)
                  showToast('Не удалось обновиться', 'error')
                })
              }}
            >
              <Icon id="i-restart" /> {updBusy ? 'Обновляем…' : 'Обновить'}
            </button>
          ) : (
            <button
              className="btn md secondary"
              disabled={updBusy}
              onClick={() => {
                setUpdBusy(true)
                void checkForUpdate(true)
                  .then((u) => {
                    setUpd(u)
                    if (!u) showToast('Стоит последняя версия')
                  })
                  .finally(() => setUpdBusy(false))
              }}
            >
              {updBusy ? <span className="spin"></span> : <Icon id="i-restart" />} Проверить
            </button>
          )}
        </div>
      </Block>

      <Group>
        {/* Не верят, что лаунчер собран из открытого кода: ссылка на релиз именно этой версии на GitHub, там файлы, отпечатки и свидетельство сборки. */}
        <Row title="Собран на GitHub" hint={ver ? 'v' + ver : undefined} keys="github исходный код открытый безопасность вирус проверить сборка">
          <button
            className="btn md secondary"
            onClick={() => void openUrl('https://github.com/copper/launcher/releases' + (ver ? '/tag/v' + ver : '')).catch(() => {})}
          >
            Открыть
          </button>
        </Row>
        <Row title="Тестовые версии" hint={beta ? 'Раньше всех, бывают поломки' : undefined} keys="бета тестирование обновления раньше">
          <Toggle
            label="Тестовые версии"
            on={beta}
            onChange={() => {
              const next = !beta
              setBeta(next)
              writePref('m-beta', next ? '1' : '0')
            }}
          />
        </Row>
        <Row title="Запускать вместе с системой" hint="Сразу в трей" keys="автозапуск автозагрузка система windows трей включение">
          <Toggle
            label="Запускать вместе с системой"
            on={autostart}
            onChange={() => {
              const next = !autostart
              setAutostartOn(next)
              if (!hasTauri()) return
              setAutostart(next)
                .then(setAutostartOn)
                .catch((err) => {
                  console.error('[settings] autostart', err)
                  setAutostartOn(!next)
                  showToast('Система не дала — попробуй ещё раз', 'error', false)
                })
            }}
          />
        </Row>
        <Row title="Крестик прячет в трей" hint={tray ? undefined : 'Трей недоступен в этой системе'} keys="трей закрывать окно свернуть">
          <Toggle
            label="Крестик прячет в трей"
            on={trayClose}
            disabled={!tray}
            onChange={() => {
              if (!tray) {
                showToast('Трей недоступен в этой системе', 'error')
                return
              }
              const next = !trayClose
              setTrayCloseOn(next)
              setTrayClose(next)
            }}
          />
        </Row>
        <Row title="Гайд по лаунчеру" keys="обучение тур подсказки помощь">
          <button className="btn sm secondary" onClick={startTour}>
            Показать
          </button>
        </Row>
        <Row
          title="Отчёт для поддержки"
          hint={diagText ? 'Скопировано — вставь в чат поддержки' : undefined}
          keys="диагностика данные поддержка ошибка логи помощь"
        >
          <button
            className="btn sm secondary"
            disabled={diagBusy}
            onClick={() => {
              setDiagBusy(true)
              buildDiagnostics()
                .then(async (text) => {
                  setDiagText(text)
                  const ok = await copyText(text)
                  showToast(ok ? 'Отчёт скопирован' : 'Не скопировалось — выдели текст ниже', ok ? 'ok' : 'error')
                  if (!ok) setDiagOpen(true)
                })
                .catch((e) => {
                  console.error('[settings] diag', e)
                  showToast('Отчёт не собрался', 'error')
                })
                .finally(() => setDiagBusy(false))
            }}
          >
            {diagBusy ? 'Собираем…' : 'Копировать'}
          </button>
          {diagText ? (
            <button className="btn sm ghost" onClick={() => setDiagOpen((o) => !o)}>
              {diagOpen ? 'Скрыть' : 'Текст'}
            </button>
          ) : null}
        </Row>
        {diagText && diagOpen ? (
          <textarea className="s2-diag" readOnly value={diagText} onFocus={(e) => e.currentTarget.select()} />
        ) : null}
      </Group>
    </>
  )

  const views: Record<SecId, ReactNode> = { look, game, files, account, about }
  const q = query.trim()

  return (
    <section className={'screen' + (on ? ' on' : '')} id="s-settings">
      <div className="s2">
        <div className="s2-head">
          <h1 className="s2-title">Настройки</h1>
          <label className="input sm s2-search">
            <Icon id="i-search" />
            <input
              value={query}
              placeholder="Найти"
              aria-label="Найти настройку"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setQuery('')
              }}
            />
            {query ? (
              <button className="s2-search-x" aria-label="Очистить поиск" onClick={() => setQuery('')}>
                <Icon id="i-x" />
              </button>
            ) : null}
          </label>
        </div>
        <nav className="set-tabs s2-tabs" role="tablist" aria-label="Разделы настроек">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={!q && sec === s.id}
              className={'set-tab' + (!q && sec === s.id ? ' on' : '')}
              onClick={() => {
                // Новая вкладка — с начала: иначе страница прыгала на
                // прокрутку прошлой вкладки (владелец: «настройки дёрганые»).
                document.querySelector('.content')?.scrollTo({ top: 0 })
                setSec(s.id)
              }}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <Query.Provider value={q}>
          <div className="s2-body">
            {q ? (
              <>
                {SECTIONS.map((s) => (
                  <div className="s2-found" key={s.id}>
                    <button className="s2-found-sec" onClick={() => setSec(s.id)}>
                      {s.label}
                      <Icon id="i-chev-r" />
                    </button>
                    {views[s.id]}
                  </div>
                ))}
                <div className="s2-empty">
                  <Icon id="i-search" />
                  <b>Ничего не нашлось</b>
                </div>
              </>
            ) : (
              views[sec]
            )}
          </div>
        </Query.Provider>
      </div>
    </section>
  )
}

/** Музыка лобби вкл/выкл — переехала из лобби (правка владельца 23.09.2026). */

