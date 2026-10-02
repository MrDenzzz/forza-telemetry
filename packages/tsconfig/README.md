# @ft/tsconfig

**English** · [Русский](README.ru.md)

Shared TypeScript configurations.

| Config         | Use for                                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `library.json` | Platform-agnostic packages consumed by Node, browsers and React Native. No ambient Node or DOM types, so `Buffer` or `window` fail to compile. |
| `node.json`    | Node.js services and CLIs (`@types/node` included).                                                                                            |

`base.json` is strict beyond `strict: true` (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, …) and is not meant to be extended directly.

## Internal package resolution

Workspace libraries expose their TypeScript sources under the `@ft/source` export condition, which every config enables via `customConditions`:

```json
"exports": {
  ".": {
    "@ft/source": "./src/index.ts",
    "default": "./dist/index.js"
  }
}
```

Type checking, linting, tests and editor navigation read sources directly, so they do not need dependencies to be built first. Runtime consumers that do not know the condition (plain Node) get the compiled `dist`.
