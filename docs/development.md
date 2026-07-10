# Development

Run the local workspace:

```bash
bun install
bun test
bun run typecheck
bun run build
bun run release:check
bun run smoke:pack
bun run stress:dev-reload --count 100
```

Dogfood examples:

```bash
bun run dev:basic
bun run dev:homework
bun run packages/boronix/src/cli/main.ts dev --runtime node --root examples/homework
```

Dev reload testing:

```bash
bun run dev:basic --debug-watch
# Edit app/routes/home/page.html and save — browser refreshes; child PID stays stable
# Edit app/routes/home/page.ts and save — isolated child restarts and loads new code
# Add app/routes/about/page.html — new route appears
# Delete the route — 404 is served
```

Local package test:

```bash
cd packages/boronix
bun run build
bun pm pack
```

Install the generated `.tgz` in a temporary app and run:

```bash
bunx boronix dev
curl http://localhost:3000/
```

`npm pack` should produce the same package shape when npm is available.

See [Dev Server](./dev-server.md) and [Reloading](./reloading.md) for development reload details.
