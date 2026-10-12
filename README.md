# Copper Launcher

Независимый форк [Millida Launcher](https://github.com/millida/launcher) на React + Tauri. Пиксельный интерфейс, локальные инстансы Minecraft и каталог Modrinth.

## Скачать

[Скачать установщик для Windows](https://github.com/CRIILET1221/CopperLauncher/releases/latest/download/Copper-Setup.exe) · [Все релизы](https://github.com/CRIILET1221/CopperLauncher/releases)

Установщик устанавливает Copper для текущего пользователя и включает отдельный деинсталлятор. Нужен Microsoft Edge WebView2 Runtime. Бинарник не подписан. Это первая экспериментальная версия форка; полный цикл установки, удаления и запуска игры ещё требует проверки.

## Возможности

- Локальные инстансы, импорт сборок и каталог Modrinth.
- Microsoft, Ely.by и офлайн-аккаунты.
- 3D-предпросмотр скина, перетаскивание PNG и локальная коллекция с миниатюрами лиц.
- Удалены рекламные и платные разделы, принудительный вход через сервис исходного лаунчера, музыка, социальные уведомления, чат, клипы и облачный раздел.
- Удалены подключение телеметрии и автоматическая установка модов исходного лаунчера. Оставшиеся служебные модули описаны в [COPPER-CHANGES.md](copper-launcher/COPPER-CHANGES.md). Это не полный аудит всех зависимостей.

## Исходники

| Папка | Назначение |
| --- | --- |
| copper-launcher | Лаунчер |
| copper-installer | Установщик Copper-Setup.exe |
| copper-uninstaller | Деинсталлятор Uninstall.exe |

## Сборка Windows

Нужны Bun, Node.js, Rust и Visual Studio Build Tools с MSVC x64/x86 и Windows SDK.

```powershell
cd copper-launcher
bun install
bun run tauri build
```

Для сборки нашего установщика из папки copper-launcher:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ..\copper-installer\build.ps1 -UseExistingLauncher
```

Готовый Copper-Setup.exe появится в корне репозитория. Без -UseExistingLauncher скрипт сначала пересоберёт лаунчер. Папки исходников должны оставаться рядом.

Параметры собственных OAuth-приложений: COPPER_MS_CLIENT_ID и COPPER_ELY_CLIENT_ID; подробности в [COPPER-CHANGES.md](copper-launcher/COPPER-CHANGES.md). В текущей сборке сохранены совместимые идентификаторы регистрации исходного проекта. Смена скина через Microsoft требует действующего аккаунта Minecraft Java; подтверждение работы скина в игре ещё проверяется.

## Лицензия

GPL-3.0-only. Сохранены авторство исходного проекта и уведомления в LICENSE, NOTICE, THIRD-PARTY.md и TRADEMARK.md. Copper не связан с Millida, Mojang или Microsoft.
