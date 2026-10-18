<p align="center"><img src="copper-launcher/public/copper-app-icon.png" width="96" alt="Copper Launcher"></p>

<h1 align="center">Copper Launcher</h1>
<p align="center">Лаунчер Minecraft без лишнего: сборки, моды из Modrinth и вход через Microsoft — в тёмном пиксельном интерфейсе.</p>
<p align="center">
  <a href="https://github.com/CRIILET1221/CopperLauncher/releases/latest">Скачать</a> ·
  <a href="#установка">Установка</a> ·
  <a href="#сборка-из-исходников">Сборка из исходников</a> ·
  <a href="LICENSING.md">Лицензия</a>
</p>

<p align="center"><img src="site/assets/shot-home.png" width="820" alt="Главный экран Copper Launcher"></p>

> **Не является официальным продуктом Minecraft. Не одобрен Mojang или Microsoft и не связан с ними.**

## Возможности

- **Сборки на любой вкус** — ванилла, Fabric, Forge, NeoForge и Quilt. У каждой сборки своя папка с модами и мирами.
- **Каталог Modrinth** — моды, сборки, ресурспаки и шейдеры прямо в лаунчере, зависимости ставятся сами.
- **Быстрый старт** — выбери сборку на главном экране и нажми «Играть». Java лаунчер скачает сам.
- **Вход через Microsoft** — официальная авторизация: пароль вводится только на сайте Microsoft, токены хранятся на компьютере в зашифрованном виде.
- **Профиль и скины** — голова скина, статус входа, переключение и выход из аккаунтов; 3D-превью скинов, локальная коллекция и смена скина в пару кликов.
- **Свой установщик** — фирменные установщик и деинсталлятор Copper. Удаление не трогает сборки, миры и аккаунты.
- **Без телеметрии и рекламы** — никакой статистики, магазина, подписок и навязчивых окон.

<p align="center">
  <img src="site/assets/shot-instances.png" width="49%" alt="Экран «Инстансы»">
  <img src="site/assets/shot-catalog.png" width="49%" alt="Каталог Modrinth">
</p>

## Установка

1. Скачай `Copper-Setup.exe` со страницы [последнего релиза](https://github.com/CRIILET1221/CopperLauncher/releases/latest).
2. Запусти установщик, выбери папку и нажми «Установить». Права администратора не нужны — Copper ставится для текущего пользователя.
3. Открой лаунчер, нажми «Аккаунты» → «Войти через Microsoft» и создай первую сборку.

Если Windows покажет «Windows защитила ваш компьютер», нажми **«Подробнее» → «Выполнить в любом случае»**: установщик пока не подписан платной цифровой подписью.

**Требования:** Windows 10 или 11 (64-бит), лицензия Minecraft: Java Edition, Microsoft Edge WebView2 Runtime (в Windows 11 уже есть).

**Обновление:** перед установкой новой версии удали старую через «Параметры → Приложения». Сборки, миры и аккаунты при этом сохраняются.

## Сборка из исходников

Подробная инструкция с установкой инструментов — в [BUILDING.md](copper-launcher/BUILDING.md).

Нужны: [Bun](https://bun.sh), [Node.js](https://nodejs.org), [Rust](https://rustup.rs) и Visual Studio Build Tools с компонентом C++.

```powershell
git clone -c core.longpaths=true https://github.com/CRIILET1221/CopperLauncher.git
cd CopperLauncher\copper-launcher
bun install
```

| Что нужно | Команда | Результат |
| --- | --- | --- |
| Запустить без установки | `bun run tauri dev` | окно лаунчера из исходников |
| Установщик для Windows | `bun run build:setup` | `outputs\Copper-Setup.exe` |
| Только деинсталлятор | `bun run build:uninstaller` | `outputs\Uninstall.exe` |
| macOS / Linux | `bun run tauri build` | `src-tauri/target/release/bundle/` |

Вход Microsoft использует client ID приложения Copper из `copper-launcher/.cargo/config.toml`. Если распространяешь собственную сборку, зарегистрируй своё приложение — см. [AUTH-SETUP.md](AUTH-SETUP.md).

## Структура репозитория

| Папка | Что внутри |
| --- | --- |
| [copper-launcher](copper-launcher) | Лаунчер: интерфейс (React + TypeScript) и ядро (Rust + Tauri) |
| [copper-installer](copper-installer) | Установщик Copper для Windows |
| [copper-uninstaller](copper-uninstaller) | Деинсталлятор Copper для Windows |
| [site](site) | Страница загрузки лаунчера |

## Лицензия

Copper распространяется под лицензией **GPL-3.0-only** — полный текст в [LICENSE](LICENSE), краткое описание в [LICENSING.md](LICENSING.md). Часть кода основана на другом лаунчере под GPL; исходные уведомления об авторских правах сохранены в [NOTICE](NOTICE), лицензии сторонних компонентов — в [THIRD-PARTY.md](THIRD-PARTY.md).

Автор и сопровождающий: **[CRIILET1221](https://github.com/CRIILET1221)**.

Minecraft — товарный знак Mojang Synergies AB / Microsoft. Copper не связан с Mojang и Microsoft и не одобрен ими.
