# Development Reloading

Boronix v0.6.0 introduces HMR-lite: fast server reload + precise browser refresh.

## How It Works

When you run `boronix dev`, Boronix watches your project files and automatically reloads when changes are detected. Connected browsers refresh through a lightweight Server-Sent Events (SSE) channel.

### Three Reload Layers

1. **Template reload** — HTML template changes (`page.html`, `layout.html`, `error.html`, `not-found.html`) invalidate the template cache and trigger a browser refresh. No process restart.

2. **Server module reload** — TypeScript module changes (`page.ts`, `api.ts`, `actions.ts`, `middleware.ts`, `app/server/**`, `app/shared/**`, `app/db/**`) restart an isolated server child process. This releases ESM module state reliably; the browser reconnects and refreshes once.

3. **Structural reload** — Route directory add/remove/rename, `boronix.config.ts`, and `.env` changes restart the isolated child.

### Full-Page Refresh

Boronix uses full-page refresh rather than a hydration-based client runtime. Browser state (form input, inline script state, scroll position) is not preserved across reloads.

## Watched Files

```txt
app/routes/**
app/server/**
app/shared/**
app/db/**
app/layout.html
app/error.html
app/not-found.html
app/middleware.ts
public/**
boronix.config.ts
drizzle.config.ts
.env
.env.local
```

## Ignored Files

```txt
node_modules/**
.git/**
.boronix/**
.boronix.tmp/**
dist/**
coverage/**
drizzle/**
*.db
*.db-journal
*.sqlite
*.sqlite3
*-wal
*-shm
npm-debug.log
bun.lock
package-lock.json
pnpm-lock.yaml
yarn.lock
```

## Browser Refresh Channel

Boronix injects a small `<script>` dev client into HTML responses during development. The client connects to an internal SSE endpoint at `/__boronix/dev-events`.

When a file change is processed:

1. The watcher detects the change.
2. The classifier determines the change kind.
3. The supervisor either sends an SSE reload to the current child or restarts that child.
4. A single reload event is broadcast to all connected browsers.
5. Each browser does `window.location.reload()`.

One batch of file changes produces at most one browser reload.

### SSE Endpoint

The `/__boronix/dev-events` endpoint only exists in `boronix dev`. It does not exist in `boronix start` or production.

Response headers:

```txt
Content-Type: text/event-stream
Cache-Control: no-cache, no-store
Connection: keep-alive
```

## Disabling Reload

```bash
boronix dev --no-reload
```

This disables browser auto-refresh and the file watcher. The dev server still runs and serves pages.

## Debug Watch

```bash
boronix dev --debug-watch
```

Prints detailed file watch diagnostics including classification and reload actions.

## Config

Dev reload is enabled by default. You can configure it in `boronix.config.ts`:

```ts
export default defineConfig({
  dev: {
    reload: true,
    watch: {
      debounce: 50
    }
  }
})
```

- `dev.reload` — Enable/disable browser auto-refresh (default: `true`).
- `dev.watch.debounce` — File event debounce in milliseconds (default: `50`, range: `10–2000`).

CLI flags take priority over config, which takes priority over defaults.

## Database Schema Changes

When `app/db/schema.ts` changes, Boronix reloads the app but does not automatically run `db push`. You may see a hint:

```txt
⚠ database schema changed; run `boronix db push` if needed
```

## Bun and Node

Both HTTP runtimes support the same user-facing reload flow. The worker is executed by Bun so application TypeScript can be loaded without a Node ESM loader; `--runtime node` selects the Node HTTP adapter.
