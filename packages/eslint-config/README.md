# @ft/eslint-config

**English** · [Русский](README.ru.md)

Shared ESLint flat configs: `typescript-eslint` strict + stylistic type-checked rules, with formatting left to Prettier.

```js
// eslint.config.js
import { node } from '@ft/eslint-config';

export default node(import.meta.dirname);
```

| Export  | Use for                                                                                                                                                   |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base`  | Platform-agnostic libraries.                                                                                                                              |
| `node`  | Node.js services and libraries (adds Node globals).                                                                                                       |
| `cli`   | Command-line tools: `node` with console output allowed.                                                                                                   |
| `react` | React on the web and in React Native: `@eslint-react` and the React Hooks rules. `eslint-plugin-react` is not used because it does not support ESLint 10. |

Configs are factories because type-aware rules need the consuming package's directory to find its `tsconfig.json`.
