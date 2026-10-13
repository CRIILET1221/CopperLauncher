import { useEffect,useRef,useState } from 'react'
import { Icon } from '../components/Icon'
import { backdropClose } from '../lib/dismiss'
import { useAccounts } from '../state/accounts'
import { cancelElyLogin,copyElyCode,copyElyVerifyLink,openElyVerifyPage,startElyLogin,useElyLogin } from '../state/elyLogin'
import { cancelWebLogin,copyUserCode,copyVerifyLink,startWebLogin,useLogin } from '../state/login'
import { cancelMsLogin,copyMsCode,copyMsVerifyLink,openMsVerifyPage,startMsLogin,useMsLogin } from '../state/msLogin'
import { closeModal,openModal,showToast,useUi } from '../state/ui'
import { SecurityInfo } from './SecurityInfo'

type Kind = 'copper' | 'microsoft' | 'elyby' | 'offline'

const KINDS: { id: Kind; ic: string; title: string; sub: string }[] = [
  {
    id: 'microsoft',
    ic: 'i-mo-shield',
    title: 'Лицензия Microsoft',
    sub: 'Лицензионные серверы, свой скин',
  },
  {
    id: 'elyby',
    ic: 'i-mo-key',
    title: 'Аккаунт Ely.by',
    sub: 'Серверы Ely.by, скин из Ely.by',
  },
  {
    id: 'offline',
    ic: 'i-mo-user',
    title: 'Офлайн-аккаунт',
    sub: 'Локальный профиль для приобретённой игры',
  },
]

function KindPanel({ kind, onBack, onDone, onSafety }: { kind: Kind; onBack: () => void; onDone: () => void; onSafety: () => void }) {
  const login = useLogin()
  const ms = useMsLogin()
  const ely = useElyLogin()
  const [nick, setNick] = useState('')
  const count = useAccounts((s) => s.list.length)
  const startCount = useRef(count)
  const doneRef = useRef(false)
  const doneCb = useRef(onDone)
  doneCb.current = onDone

  useEffect(() => {
    if (doneRef.current || count === startCount.current) return
    doneRef.current = true
    doneCb.current()
  }, [count])

  const createOffline = () => {
    const v = nick.trim()
    if (!/^[A-Za-z0-9_]{3,16}$/.test(v)) {
      showToast('Ник: латиница, цифры и _, от 3 до 16 символов', 'error')
      return
    }
    useAccounts.getState().add({ nick: v, kind: 'offline' })
    onDone()
    showToast('Аккаунт создан: ' + v)
  }

  const meta = KINDS.find((k) => k.id === kind)!
  const busy = kind === 'copper' ? login.webBusy : kind === 'microsoft' ? ms.busy : kind === 'elyby' ? ely.busy : false
  const code = kind === 'copper' ? login.userCode : kind === 'elyby' ? ely.userCode : ms.userCode
  const hint = kind === 'copper' ? login.hintText : kind === 'elyby' ? ely.hint : ms.hint

  return (
    <>
      <button
        className="btn sm ghost"
        style={{ alignSelf: 'flex-start', marginBottom: '12px' }}
        onClick={() => {
          if (kind === 'copper') cancelWebLogin()
          if (kind === 'microsoft') cancelMsLogin()
          if (kind === 'elyby') cancelElyLogin()
          onBack()
        }}
      >
        <Icon id="i-chev-l" />
        Назад
      </button>
      <div className="acc-opt" style={{ cursor: 'default' }}>
        <span className="acc-opt-ic">
          <Icon id={meta.ic} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: 'block', fontSize: '13.5px', fontWeight: 650 }}>{meta.title}</b>
          <span style={{ fontSize: '12px', color: 'var(--m-fg-subtle)' }}>{meta.sub}</span>
        </span>
      </div>

      {kind === 'offline' ? (
        <div style={{ marginTop: '16px' }}>
          <div className="input" style={{ width: '100%' }}>
            <input
              placeholder="Ник в игре (латиница, 3–16)"
              maxLength={16}
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createOffline()
              }}
            />
          </div>
          <button className="btn md primary" style={{ width: '100%', marginTop: '12px' }} onClick={createOffline}>
            Создать
          </button>
        </div>
      ) : (
        <div style={{ marginTop: '16px' }}>
          {busy && code ? (
            <>
              <button
                className="acc-code"
                aria-label="Скопировать код"
                onClick={() => void (kind === 'copper' ? copyUserCode() : kind === 'elyby' ? copyElyCode() : copyMsCode())}
              >
                <span>{code}</span>
                <Icon id="i-copy" />
              </button>
              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  className="btn sm secondary"
                  style={{ flex: 1 }}
                  onClick={() => (kind === 'copper' ? void startWebLogin(true) : kind === 'elyby' ? openElyVerifyPage() : openMsVerifyPage())}
                >
                  Открыть страницу
                </button>
                <button
                  className="btn sm ghost"
                  onClick={() => (kind === 'copper' ? copyVerifyLink() : kind === 'elyby' ? copyElyVerifyLink() : copyMsVerifyLink())}
                >
                  Копировать ссылку
                </button>
                <button
                  className="btn sm ghost"
                  onClick={() => (kind === 'copper' ? cancelWebLogin() : kind === 'elyby' ? cancelElyLogin() : cancelMsLogin())}
                >
                  Отмена
                </button>
              </div>
            </>
          ) : (
            <button
              className="btn md primary"
              style={{ width: '100%' }}
              disabled={busy}
              onClick={() => void (kind === 'copper' ? startWebLogin() : kind === 'elyby' ? startElyLogin() : startMsLogin())}
            >
              <Icon id={meta.ic} />
              {busy
                ? 'Ждём подтверждения…'
                : kind === 'copper'
                  ? 'Войти через Copper'
                  : kind === 'elyby'
                    ? 'Войти через Ely.by'
                    : 'Войти через Microsoft'}
            </button>
          )}
          {/* Строка доверия под входом Microsoft (06.10.2026): ведёт на разбор
              безопасности на сайте. Текст короткий, факты — на странице. */}
          {kind === 'microsoft' ? (
            <div className="faint-note" style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <Icon id="i-shield" />
              <span>Авторизация через Microsoft</span>
              <a
                href="#microsoft-sign-in"
                onClick={(e) => {
                  e.preventDefault()
                  onSafety()
                }}
              >
                Как это работает?
              </a>
            </div>
          ) : null}
          {/* Пояснение по умолчанию снято: кнопка «Войти через …» и код говорят сами.
              Живую подсказку процесса входа (hint) оставляем — это статус, а не абзац. */}
          {hint ? (
            <p className="faint-note" style={{ marginTop: '12px', lineHeight: 1.5 }}>
              {hint}
            </p>
          ) : null}
        </div>
      )}
    </>
  )
}

const MICROSOFT_ACCOUNT_EVENT = 'account-add-microsoft'
export function openMicrosoftAccount() {
  window.dispatchEvent(new Event(MICROSOFT_ACCOUNT_EVENT))
  openModal('accModal')
}

export function AccountAddModal() {
  const modal = useUi((s) => s.modals.accModal)
  const [kind, setKind] = useState<Kind | null>(null)
  const [safety, setSafety] = useState(false)
  useEffect(() => {
    const selectMicrosoft = () => { setKind('microsoft'); setSafety(false) }
    window.addEventListener(MICROSOFT_ACCOUNT_EVENT, selectMicrosoft)
    return () => window.removeEventListener(MICROSOFT_ACCOUNT_EVENT, selectMicrosoft)
  }, [])

  useEffect(() => {
    if (!modal.open) {
      setKind(null)
      setSafety(false)
    }
  }, [modal.open])

  useEffect(() => {
    if (!modal.open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal('accModal')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [modal.open])

  if (!modal.open) return null
  const close = () => closeModal('accModal')

  return (
    <div
      className={'modal-bg' + (modal.open ? ' open' : '') + (modal.vis ? ' vis' : '')}
      id="accModal"
      {...backdropClose(close)}
    >
      <div className={'modal ' + (safety ? 'mw-md' : 'mw-sm')} style={{ display: 'flex', flexDirection: 'column' }}>
        <h3>{safety ? 'Как это работает' : 'Добавить аккаунт'}</h3>

        <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column' }}>
          {safety ? (
            <SecurityInfo onBack={() => setSafety(false)} />
          ) : kind ? (
            <KindPanel kind={kind} onBack={() => setKind(null)} onDone={close} onSafety={() => setSafety(true)} />
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {KINDS.map((k) => (
                <button key={k.id} className="acc-opt" onClick={() => setKind(k.id)}>
                  <span className="acc-opt-ic">
                    <Icon id={k.ic} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ display: 'block', fontSize: '13.5px', fontWeight: 650 }}>{k.title}</b>
                    <span style={{ fontSize: '12px', color: 'var(--m-fg-subtle)' }}>{k.sub}</span>
                  </span>
                  <Icon id="i-chev-r" style={{ color: 'var(--m-fg-faint)' }} />
                </button>
              ))}
              
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '22px' }}>
          <button className="btn md secondary" data-sound="close" onClick={close}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}
