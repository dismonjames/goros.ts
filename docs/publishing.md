# Publishing

Before publishing:

```bash
bun install
bun test
bun run typecheck
bun run build
```

Package checks:

```bash
cd packages/kumquat
npm pack
```

The `kumquat` package must include:

- `dist/index.js`
- `dist/index.d.ts`
- `dist/cli/main.js`
- `README.md`
- `LICENSE`

Create package checks:

```bash
cd packages/create-kumquat
npm pack
```

The `create-kumquat` package must include `dist/index.js` and `src/templates/basic`.

For local dry runs without npm, use `bun pm pack`.
