# Forza Telemetry

[English](README.md) · **Русский**

Телеметрия Forza Horizon 6 в реальном времени. Сервис на NestJS принимает UDP-поток «Data Out» из игры, определяет сессии и круги, сохраняет аналитику кругов в Postgres и транслирует живые данные в дашборд на Next.js и приборную панель на React Native.

> Проект в разработке и строится по шагам, см. [план](#план).

## Структура репозитория

```
apps/        приложения, которые деплоятся (api, web, mobile)
packages/    общие библиотеки и конфигурация
tools/       CLI для разработки (recorder, replayer)
docs/        архитектурные решения и описание протокола
```

## Быстрый старт

Нужны Node.js 24 LTS и pnpm 12 (`npm install --global pnpm@12`).

```sh
pnpm install
pnpm check
```

| Скрипт           | Что делает                                        |
| ---------------- | ------------------------------------------------- |
| `pnpm dev`       | Запуск API в режиме watch                         |
| `pnpm check`     | Линт, проверка типов, тесты и сборка всех пакетов |
| `pnpm lint`      | ESLint с правилами, использующими типы            |
| `pnpm typecheck` | Проверка типов TypeScript во всех пакетах         |
| `pnpm test`      | Модульные и интеграционные тесты                  |
| `pnpm build`     | Продакшен-сборки                                  |
| `pnpm format`    | Форматирование репозитория через Prettier         |
| `pnpm record`    | Запись телеметрии игры в файл                     |
| `pnpm replay`    | Воспроизведение записи по UDP                     |

Коммиты оформляются по [Conventional Commits](https://www.conventionalcommits.org/ru/v1.0.0/). Git-хук, который ставится при `pnpm install`, проверяет сообщения коммитов и форматирует индексированные файлы.

## Подключение игры

В Forza Horizon 6 откройте Settings → HUD and Gameplay и установите **Data Out** в On, **Data Out IP Address** — `127.0.0.1`, **Data Out IP Port** — `9876`. Версиям из Microsoft Store и PC Game Pass также нужно [исключение для loopback](docs/fh6-data-out.ru.md#настройка-сети-в-windows).

## Запуск API

```sh
pnpm dev                                          # API на http://localhost:4000, телеметрия на UDP 9876
pnpm replay recordings/<файл>.ftr.gz --loop       # без игры: проиграть в него запись
```

Live-данные идут по WebSocket на `ws://localhost:4000/live`; `GET /health` показывает, присылает ли игра данные. Конфигурация и точки входа: [apps/api](apps/api/README.ru.md).

## Запись и воспроизведение

Игра отправляет данные, только пока вы едете, поэтому разработка, тесты и задеплоенное демо работают на записях.

```sh
pnpm record --note "Goliath, 3 круга"
pnpm replay recordings/fh6-<timestamp>.ftr.gz --loop
```

Подробнее: [recorder](tools/recorder/README.ru.md), [replayer](tools/replayer/README.ru.md) и [ADR 0002](docs/adr/0002-recording-format.ru.md) о формате файла.

## Документация

У каждого документа есть русская версия (`*.ru.md`), ссылка на неё стоит в начале документа.

- [Справочник по «Data Out» Forza Horizon 6](docs/fh6-data-out.ru.md): раскладка пакета, источники, открытые вопросы, настройка сети
- [Архитектурные решения (ADR)](docs/adr/README.ru.md)

## План

- [x] Основа монорепо: workspaces, общие конфиги, CI
- [x] Парсер пакета, recorder и replayer
- [x] API: приём UDP и live-поток по WebSocket
- [ ] Web: live-дашборд
- [ ] Сессии, круги, история и сравнение кругов
- [ ] Mobile: live-приборы
- [ ] Docker, деплой, демо-режим

## Лицензия

[MIT](LICENSE)

---

Проект не связан с Microsoft, Xbox Game Studios и Playground Games и не одобрен ими. Forza Horizon — товарный знак Microsoft Corporation.
