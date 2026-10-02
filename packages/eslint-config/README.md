# @ft/eslint-config

**English** · [Русский](README.ru.md)

Shared ESLint flat configs: `typescript-eslint` strict + stylistic type-checked rules, with formatting left to Prettier.

```js
// eslint.config.js
import { node } from '@ft/eslint-config';

export default node(import.meta.dirname);
```

| Export | Use for                                        |
| ------ | ---------------------------------------------- |
| `base` | Platform-agnostic libraries.                   |
| `node` | Node.js services and CLIs (adds Node globals). |

Configs are factories because type-aware rules need the consuming package's directory to find its `tsconfig.json`.
