# Как собрать Copper Launcher самому

Первая сборка — 10–20 минут, смотря какой компьютер. Дальше быстрее: Rust пересобирает только изменённое.

## 1. Поставь инструменты

<details open>
<summary><b>Windows 10/11</b></summary>

В PowerShell:

```powershell
winget install --id Git.Git -e
winget install --id Oven-sh.Bun -e
winget install --id Rustlang.Rustup -e
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

После установки закрой и открой PowerShell заново — иначе он не увидит `bun` и `cargo`.

WebView2 в Windows 11 уже есть. На Windows 10 — [скачать у Microsoft](https://developer.microsoft.com/microsoft-edge/webview2/).
</details>

<details>
<summary><b>macOS</b></summary>

```bash
xcode-select --install
curl -fsSL https://bun.sh/install | bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```
</details>

<details>
<summary><b>Linux (Debian, Ubuntu, Mint)</b></summary>

```bash
sudo apt-get install -y git curl libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libxdo-dev libssl-dev build-essential file wget
curl -fsSL https://bun.sh/install | bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Другие дистрибутивы — названия пакетов в [документации Tauri](https://tauri.app/start/prerequisites/#linux).
</details>

## 2. Собери

```bash
git clone -c core.longpaths=true https://github.com/CRIILET1221/CopperLauncher.git
cd CopperLauncher/copper-launcher
bun install
```

**Windows** — фирменный установщик Copper. Одна команда собирает лаунчер,
деинсталлятор и упаковывает их в `Copper-Setup.exe`:

```powershell
bun run build:setup
```

Классический NSIS-установщик на Windows не собирается: `bun run tauri build`
здесь даёт только `copper-launcher.exe` без установщика.

**macOS и Linux:**

```bash
bun run tauri build
```

## 3. Забери результат

| Система | Где лежит |
| --- | --- |
| Windows | `outputs\Copper-Setup.exe` в корне репозитория (рядом лежит `Uninstall.exe`) |
| macOS | `src-tauri/target/release/bundle/dmg/` и `bundle/macos/Copper Launcher.app` |
| Linux | `src-tauri/target/release/bundle/` — `deb/`, `rpm/`, `appimage/` |

Запустить без установки, прямо из исходников: `bun run tauri dev`.

## Подпись и обновления

Сборка не подписана цифровой подписью — Windows покажет «Неизвестный издатель».
Автообновление в Copper отключено: новую версию собирай и ставь сам.

## Если не собирается

| Ошибка | Что сделать |
| --- | --- |
| `linker 'link.exe' not found` | Не стоит Build Tools с C++ — команда из шага 1 для Windows |
| `bun` или `cargo` «не является командой» | Перезапусти терминал после установки |
| `webkit2gtk-4.1 not found` | Не поставлены пакеты из шага 1 для Linux |
| AppImage падает на `linuxdeploy` | Собери без него: `bun run tauri build --bundles deb` |
| `Filename too long` при клонировании | Клонируй с `-c core.longpaths=true`, как в шаге 2 |
| Что-то другое | [Заведи issue](https://github.com/CRIILET1221/CopperLauncher/issues) и приложи вывод команды |

Хочешь прислать правку — [CONTRIBUTING.md](CONTRIBUTING.md). Условия бренда оригинального проекта — [TRADEMARK.md](TRADEMARK.md).
