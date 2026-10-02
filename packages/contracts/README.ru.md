# @ft/contracts

[English](README.md) · **Русский**

Единый источник правды о том, что отправляет API: схемы Zod и выведенные из них типы TypeScript, общие для API, веб-дашборда и мобильного приложения. Не зависит от платформы.

```ts
import { parseLiveServerMessage } from '@ft/contracts';

socket.onmessage = (event) => {
  const result = parseLiveServerMessage(event.data);
  if (result.ok && result.value.type === 'frame') {
    render(result.value.frame);
  }
};
```

| Экспорт                              | Назначение                                                                                                     |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `LIVE_PATH`, `LIVE_PROTOCOL_VERSION` | Путь WebSocket и версия, которую сервер сообщает в `hello`; несовместимое изменение схем увеличивает её        |
| `liveServerMessageSchema`            | Объединение сообщений `hello`, `status` и `frame`                                                              |
| `liveFrameSchema`, `LiveFrame`       | Один снимок телеметрии в единицах СИ: м/с, °C, g, педали в диапазоне 0–1 (руль −1–1), передача −1 — задний ход |
| `telemetryStateSchema`               | `offline`, `idle` (игра запущена, но никто не едет) или `driving`                                              |
| `parseLiveServerMessage(text)`       | Разбор JSON и валидация без исключений                                                                         |
| `healthResponseSchema`               | Ответ `GET /health`                                                                                            |

API собирает кадры, которые удовлетворяют этим схемам, а его e2e-тест проверяет по ним каждое отправленное сообщение; клиенты проверяют то, что получают.
