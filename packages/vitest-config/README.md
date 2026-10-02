# @ft/vitest-config

**English** · [Русский](README.ru.md)

Shared Vitest configuration.

```js
// vitest.config.js
export { node as default } from '@ft/vitest-config';
```

| Export | Use for                                                                                            |
| ------ | -------------------------------------------------------------------------------------------------- |
| `node` | Node.js packages. Resolves workspace dependencies to their sources via the `@ft/source` condition. |
| `web`  | Browser code in happy-dom, with the same source resolution for client and server conditions.       |
