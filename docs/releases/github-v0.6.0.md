# v0.6.0 - Dev Server Speed & HMR-lite

## Highlights

- Added stable development file watching with debouncing and ignore rules.
- Added template cache invalidation for instant HTML template reloads.
- Added isolated child-process restarts for route and shared server code changes.
- Added automatic browser refresh through Server-Sent Events (SSE).
- Added route add/remove/rename detection with incremental route rescanning.
- Added public asset reload handling.
- Added safe config and environment file reload behavior.
- Added watch event debouncing and ignore rules to prevent reload loops.
- Added reload latency logs and watch diagnostics (`--debug-watch`).
- Added Bun and Node development runtime coverage.

## HMR-lite

Boronix v0.6.0 introduces HMR-lite: fast server reload + precise browser refresh.

### Three reload layers

1. **Template reload** — HTML template changes invalidate cache and refresh the browser. No process restart.
2. **Server module reload** — TypeScript module changes restart an isolated child. Browser reconnects and refreshes.
3. **Structural reload** — Route structure and config changes restart that child.

Boronix uses full-page refresh rather than a hydration-based client runtime. Browser state is not preserved.

## Browser Refresh

A lightweight dev client script is injected into HTML responses during `boronix dev`. The client connects to an internal SSE endpoint at `/__boronix/dev-events` and triggers `window.location.reload()` when a reload event is received.

- One batch of file changes = at most one browser reload.
- Dev client is only injected in dev mode, only into HTML responses.
- The SSE endpoint does not exist in production.

## New CLI Flags

| Flag | Description |
|------|-------------|
| `--no-reload` | Disable browser auto-refresh and file watcher |
| `--debug-watch` | Print detailed file watch diagnostics |

## File Change Classification

| Path | Classification | Behavior |
|------|---------------|----------|
| `app/routes/*/page.html` | template | Cache invalidate, browser refresh |
| `app/layout.html` | template | Cache invalidate, browser refresh |
| `app/routes/*/page.ts` | route-module | App generation reload |
| `app/routes/*/api.ts` | route-module | App generation reload |
| `app/routes/*/actions.ts` | route-module | App generation reload |
| `app/server/**` | shared-module | Full app generation reload |
| `app/shared/**` | shared-module | Full app generation reload |
| `app/db/**` | shared-module | Full app generation reload |
| `public/**` | public-asset | Browser refresh |
| Route dir add/remove | route-structure | Route tree rescan |
| `boronix.config.ts` | config | Config reload + route rescan |
| `.env` / `.env.local` | env | Config reload + route rescan |

## Bun and Node Support

Both runtimes support the full dev reload flow: file watcher, route reload, browser SSE, template reload, and module reload.

## Known Limitations

- Browser state is not preserved across reloads.
- Form input not yet submitted will be lost on full-page refresh.
- Inline script state is reset on refresh.
- Config/env changes trigger a controlled app reload.
- Shared server module changes reload the entire app generation.
- Network filesystem watcher behavior depends on OS/runtime.
- No CSS-only hot injection in this phase.

## Migration Notes

- No breaking changes. `boronix dev` continues to work without any config changes.
- Dev reload is enabled by default. Use `--no-reload` to disable.
- The `/__boronix/dev-events` endpoint is reserved in dev mode. If you have a route at this path, rename it.
