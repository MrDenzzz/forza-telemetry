# @ft/vitest-config

[English](README.md) · **Русский**

Общая конфигурация Vitest.

```js
// vitest.config.js
export { node as default } from '@ft/vitest-config';
```

| Экспорт | Для чего                                                                                        |
| ------- | ----------------------------------------------------------------------------------------------- |
| `node`  | Пакеты для Node.js. Зависимости из workspace резолвятся в исходники через условие `@ft/source`. |
