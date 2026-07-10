# Dev Server

The Boronix dev server (`boronix dev`) provides a fast development loop with automatic file watching and browser refresh.

## Starting the Dev Server

```bash
boronix dev
```

Options:

```bash
boronix dev --runtime bun       # Use Bun runtime (default)
boronix dev --runtime node      # Use Node runtime
boronix dev --port 3000         # Custom port
boronix dev --host 0.0.0.0      # Custom host
boronix dev --open              # Open browser automatically
boronix dev --quiet             # Minimal output
boronix dev --verbose           | Detailed output with static asset logs
boronix dev --no-reload         # Disable browser auto-refresh and watcher
boronix dev --debug-watch       # Print detailed file watch diagnostics
boronix dev --plain             # Disable colors, unicode, spinner
boronix dev --no-color          # Disable colors
```

## Startup Output

```txt
◆ Boronix

  ✔ mode      dev
  ✔ runtime   bun
  ➜ local     http://localhost:3000
  ⌂ root      ~/my-app
  ◇ reload    enabled

✔ ready, serving HTML in 48ms
```

## Reload Output

When files change, short reload logs appear:

```txt
✔ reload  page.html                  7ms
✔ reload  app/routes/login/page.ts  18ms
✔ routes  rescanned                 22ms
✔ asset   public/style.css           2ms
```

## HMR-lite

Boronix uses HMR-lite: fast server reload + precise browser refresh. See [Reloading](./reloading.md) for details.

## Quiet and Plain Modes

```bash
boronix dev --quiet       # Minimal startup, no reload logs, errors only
boronix dev --plain       # No ANSI colors or unicode symbols
NO_COLOR=1 boronix dev    # Disable colors via env
CI=true boronix dev       # Deterministic output, no browser open
```

## Debug Watch

```bash
boronix dev --debug-watch
```

Outputs detailed watch diagnostics:

```txt
watch modify app/routes/home/page.html
classify template
invalidate template cache
broadcast reload revision=4
```

## Graceful Shutdown

The dev server cleans up watchers, SSE connections, and the server listener on `SIGINT` / `SIGTERM`:

```txt
⚠ shutdown requested
✔ dev server stopped
```
