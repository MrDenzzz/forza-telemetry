# @ft/live-client

[English](README.md) · **Русский**

Клиент live-потока API по WebSocket, общий для веб-дашборда и мобильного приложения. Ядро не зависит от фреймворка; привязки к React лежат в `@ft/live-client/react`.

```tsx
import { LiveStore } from '@ft/live-client';
import { LiveStoreProvider, useFrameValue } from '@ft/live-client/react';

const store = new LiveStore({ url: 'ws://localhost:4000/live', historySeconds: 30 });

function Speed() {
  const kmh = useFrameValue((frame) => Math.round(frame.speed * 3.6), 0);
  return <span>{kmh} km/h</span>;
}

<LiveStoreProvider store={store}>
  <Speed />
</LiveStoreProvider>;
```

| Экспорт                                    | Назначение                                                                                                                                   |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `LiveConnection`                           | Держит сокет открытым: экспоненциальная задержка с джиттером, проверка каждого сообщения, окончательная остановка при несовпадении протокола |
| `LiveStore`                                | Статус, последний кадр и история, с отдельными подписчиками на статус и на кадры                                                             |
| `FrameHistory`                             | Кольцевой буфер последних кадров фиксированного размера; `columns()` для графиков, `recent()` для следа                                      |
| `LiveStoreProvider`, `useConnectionStatus` | Передать store в дерево и читать его статус; компоненты, зависящие только от статуса, не реагируют на кадры                                  |
| `useFrameValue(select, fallback)`          | Одно значение из последнего кадра; перерисовка только при изменении этого значения, поэтому `select` возвращает примитив                     |

Статусы: `connecting`, `connected` (с состоянием игры и частотой кадров), `waiting` (следующая попытка и её задержка) и `incompatible`. Почему всё устроено так: [ADR 0004](../../docs/adr/0004-live-dashboard-rendering.ru.md).
