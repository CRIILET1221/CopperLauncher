import { Icon } from '../components/Icon'

export function SecurityInfo({ onBack }: { onBack: () => void }) {
  return <div className="sec-info">
    <button className="btn sm ghost" onClick={onBack}><Icon id="i-chev-l" /> Назад</button>
    <h3>Вход через Microsoft</h3>
    <p>Лаунчер показывает код и открывает страницу Microsoft. Введи код и подтверди вход в браузере.</p>
    <p>Пароль вводится на странице Microsoft. Copper получает токены авторизации через API Microsoft, Xbox и Minecraft.</p>
    <p>Сохранённые токены хранятся локально в зашифрованном хранилище. Сервис регистрации исходного лаунчера отключён.</p>
  </div>
}
