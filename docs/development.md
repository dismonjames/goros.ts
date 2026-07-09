# Development

Run the local workspace:

```bash
bun install
bun test
bun run typecheck
bun run build
```

Dogfood examples:

```bash
bun run dev:basic
bun run dev:homework
bun run packages/kumquat/src/cli/main.ts dev --runtime node --root examples/homework
```

Local package test:

```bash
cd packages/kumquat
bun run build
bun pm pack
```

Install the generated `.tgz` in a temporary app and run:

```bash
bunx kumquat dev
curl http://localhost:3000/
```

`npm pack` should produce the same package shape when npm is available.
