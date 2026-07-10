# Architectural Decisions Log - Boronix Rebrand

This document outlines design and rebranding decisions made during version `v0.2.5`.

## Decisions

### 1. NPM Registry Name Availability Verification
- Checked name availability for `boronix` and `create-boronix` on the public npm registry.
- Both packages returned `404 Not Found` (confirming they are completely available to claim and publish).

### 2. Configuration File Fallbacks
- We prefer the new `boronix.config.ts` configuration file.
- If it is missing, we fall back to `kumquat.config.ts` if it exists, logging a deprecation warning:
  `⚠ kumquat.config.ts is deprecated. Rename it to boronix.config.ts.`

### 3. Build Manifest Migrations
- Production builds are output to `.boronix/` containing `manifest.json`.
- If a legacy `.kumquat/` folder is detected on server boot, `boronix start` will fail with code 1 and guide the user to rebuild:
  `Found old .kumquat build output. Run \`boronix build\` to generate .boronix.`

### 4. Git Tagging Constraint
- Git tagging is not executed automatically, following the directive: "Do not create tag unless explicitly asked."

## v0.3.0 Decisions

### 1. Action Helper Wrapper Validation
- Attached a non-enumerable property `_isBoronixAction: true` to the action handler returned by `action()`.
- Used this flag in `handleAction` to throw `KQ_ACTION_NOT_WRAPPED` if a named export in `actions.ts` is not wrapped in `action()`.

### 2. Error Phase Separation
- Dynamic route/request processing phases are tracked using try/catch blocks tagging the error with the corresponding phase: `config`, `middleware`, `layout`, `page-loader`, `page-render`, `api`, `action`, `static`, `router`.

### 3. Stack Trace Cleaning and Caret Pointing
- Normalized filenames using root relative paths.
- Extracted exact line and column numbers from the first user stack frame, generating an aligned code frame snippet. The caret points directly to the matching character.

### 4. 404/NotFound throwing/returning Response
- Defined `notFound()` to return a 404 Response. Intercepted 404 Responses (returned or thrown) inside loaders/APIs/actions to trigger custom `not-found.html` page rendering or 404 JSON response.

## v0.4.0 Decisions

### 1. Drizzle Is The Database Layer
- Boronix provides Drizzle templates, conventions, CLI wrappers, and examples.
- Boronix does not implement an ORM, database engine, or migration engine.

### 2. SQLite Driver
- Tried `better-sqlite3` first, matching the phase requirement.
- `bun install` failed in this environment because `better-sqlite3` fell back to native build and `node-gyp` was unavailable.
- Switched SQLite templates to `bun:sqlite` with `drizzle-orm/bun-sqlite`, which Drizzle documents as a native Bun SQLite driver path.

### 3. Notes Actions Use Current Boronix Form API
- The requested CRUD action snippets used `request.formData()`, but Boronix action context currently exposes the `form` helper.
- Generated notes actions use `form.string()` and `form.number()` plus `fail(data, { status })` so templates compile against the current public API.

## v0.5.0 Decisions

### 1. Environment Mode Standardization
- Normalized mode to `"development"` and `"production"`.
- Mode resolution order: CLI command -> `BORONIX_ENV` -> `NODE_ENV`.
- Avoided ad-hoc reading of environment variables by centralizing it in `core/mode.ts`.

### 2. Session Usage Detection
- Recursively scans the `app/` folder for `session` or `auth` keywords to determine if session features are used, preventing the need to enforce session secrets on purely static/basic apps.

### 3. Atomic Build Output Writes
- Implemented build compilation to `.boronix.tmp`. On success, `.boronix` is rotated to `.boronix.bak` and renamed to `.boronix`. If an error occurs, `.boronix.tmp` is deleted and `KQ_BUILD_OUTPUT_WRITE_FAILED` is thrown.

### 4. Production Error Safety
- 5xx errors in production default to "Internal Server Error" message rendering, with all stack traces, configuration settings, credentials, and filesystem paths stripped out.
- For API endpoints, JSON error envelopes alongside a unique Request ID are returned to enable debugging without information leakage.

### 5. Dependency Audit (v0.5.0)
- `bun audit` reports 1 moderate vulnerability: `esbuild <=0.24.2` (GHSA-67mh-4wv8-2f99).
- This vulnerability is in the `drizzle-kit` devDependency chain, not in production runtime code.
- `esbuild`'s development server can be accessed cross-origin, but this only affects local development.
- Production runtime (`boronix` package) has zero dependencies and is not affected.
- Not updating `drizzle-kit` to avoid breaking changes without thorough testing. Will revisit when upstream fix is released.

### 6. Legacy Manifest Handling
- Chose option B for legacy `.boronix` manifests from v0.4.x: report `KQ_BUILD_VERSION_UNSUPPORTED` and require running `boronix build` again.
- This is simpler and clearer than attempting migration/normalization of old manifests.

## v0.6.0 Decisions

### 1. SSE over WebSocket for Browser Refresh
- Chose Server-Sent Events (SSE) over WebSocket for the browser reload channel.
- SSE is simpler, unidirectional (server→browser), works with standard `EventSource`, and requires no client-side library.
- The dev endpoint `/__boronix/dev-events` only exists in dev mode, never in production.

### 2. Full-Page Refresh over HMR
- Chose full-page refresh (`window.location.reload()`) over component-level HMR.
- Boronix is HTML-first with no hydration system, so component-level state preservation is not applicable.
- One batch of file changes produces at most one browser reload to avoid flicker.

### 3. Isolated Child Restart for Module Reload
- Bun caches ESM modules by physical path even when the import URL query changes, so query-string cache busting was rejected.
- The long-lived supervisor owns watching, batching, terminal UI, and child lifecycle; the child owns HTTP, SSE, and user modules.
- Route/shared/config/env changes replace the child process, releasing all server module state. Templates and public assets remain in-process and are served fresh from disk.
- The browser EventSource reconnects after a child restart and performs exactly one full refresh for the new revision.

### 4. Node fs.watch with Recursive Option
- Chose Node.js `fs.watch` with `{ recursive: true }` over adding a third-party watcher dependency like `chokidar`.
- `fs.watch` recursive is supported on macOS and Windows natively, and on Linux with Bun.
- Debounce (50ms default) handles duplicate OS events and rapid consecutive saves.
- No external dependency added, keeping the framework zero-dependency.

### 5. Reload Failure: Keep Process Alive
- On reload failure (e.g., TypeScript syntax error), the dev process stays alive.
- The previous working app generation continues to serve requests until the next successful reload.
- Reload errors are broadcast to the browser via SSE `error` events.
- When the user fixes the error, the next reload succeeds and the app recovers automatically.
- Chose option A (keep old generation) as the practical default because it avoids showing broken pages for unrelated routes.

### 6. Dev Client Injection Strategy
- Inject the dev client script before `</body>` (or append to end if no `</body>`).
- Only inject into HTML responses (check `content-type`), not JSON, static assets, or redirects.
- Guard against double injection via `window.__boronixDevClientConnected` flag and `data-boronix-dev-client` attribute check.
- CSP policies that block inline scripts will prevent injection — documented as a known limitation, no workaround implemented.

### 7. Reserved Dev Route Prefix
- Reserved `/__boronix/dev-events` in dev mode only.
- `KQ_DEV_ROUTE_CONFLICT` error if user has a route at this path.
- Production does not reserve this path since the endpoint does not exist.

### 8. Debounce Window
- Default 50ms debounce, configurable via `dev.watch.debounce` (range 10–2000ms).
- Multiple events for the same file within the window are coalesced into a single change.
- A batch of changes across multiple files produces one reload event.
