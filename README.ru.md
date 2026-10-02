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
| `pnpm check`     | Линт, проверка типов, тесты и сборка всех пакетов |
| `pnpm lint`      | ESLint с правилами, использующими типы            |
| `pnpm typecheck` | Проверка типов TypeScript во всех пакетах         |
| `pnpm test`      | Модульные и интеграционные тесты                  |
| `pnpm build`     | Продакшен-сборки                                  |
| `pnpm format`    | Форматирование репозитория через Prettier         |

Коммиты оформляются по [Conventional Commits](https://www.conventionalcommits.org/ru/v1.0.0/). Git-хук, который ставится при `pnpm install`, проверяет сообщения коммитов и форматирует индексированные файлы.

## Документация

У каждого документа есть русская версия (`*.ru.md`), ссылка на неё стоит в начале документа.

- [Справочник по «Data Out» Forza Horizon 6](docs/fh6-data-out.ru.md): раскладка пакета, источники, открытые вопросы, настройка сети
- [Архитектурные решения (ADR)](docs/adr/README.ru.md)

## План

- [x] Основа монорепо: workspaces, общие конфиги, CI
- [ ] Парсер пакета, recorder и replayer
- [ ] API: приём UDP и live-поток по WebSocket
- [ ] Web: live-дашборд
- [ ] Сессии, круги, история и сравнение кругов
- [ ] Mobile: live-приборы
- [ ] Docker, деплой, демо-режим

## Лицензия

[MIT](LICENSE)

---

Проект не связан с Microsoft, Xbox Game Studios и Playground Games и не одобрен ими. Forza Horizon — товарный знак Microsoft Corporation.
