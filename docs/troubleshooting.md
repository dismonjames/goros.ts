# Troubleshooting

## File changes not detected

If your file changes are not triggering reloads:

1. Verify you are running `boronix dev` (not `boronix start`).
2. Check that `--no-reload` is not set.
3. Run with `--debug-watch` to see if events are being received:

```bash
boronix dev --debug-watch
```

4. Ensure the file is in a watched directory (see [Reloading](./reloading.md)).
5. Ensure the file is not in an ignored directory (`node_modules`, `.boronix`, `dist`, etc.).

## Editor atomic save

Some editors use atomic save (write to temp file, then rename). Boronix's watcher handles this via debounce and rename event detection. If you experience issues:

- Try saving with a different editor to isolate the issue.
- Use `--debug-watch` to see what events are received.

## Network filesystem

File watching on network filesystems (NFS, SSHFS, Docker mounted volumes, WSL mounted volumes) may not receive events reliably. This is an OS/runtime limitation.

If you are on WSL or Docker and watching a Windows/host-mounted volume, consider:

- Working inside the Linux filesystem rather than a mounted Windows path.
- Using `--debug-watch` to verify if events arrive.

## Too many file watcher errors

If you see `EMFILE` or similar errors, your OS may have a low file watcher limit. The Boronix watcher uses recursive watching to minimize the number of watchers, but very large projects may still hit limits.

## Port conflict

If the dev server fails to start with an address-in-use error:

```bash
boronix dev --port 3001
```

Or free the port:

```bash
lsof -i :3000   # macOS/Linux
kill <pid>
```

## Browser not reconnecting SSE

The dev client uses `EventSource` which reconnects automatically. If the browser is not reconnecting:

1. Check that the dev server is still running.
2. Hard-refresh the browser (Ctrl+Shift+R).
3. Check the browser console for SSE connection errors.
4. Verify no CSP policy is blocking `EventSource` connections to `/__boronix/dev-events`.

If your app sets a Content-Security-Policy header that blocks inline scripts, the dev client injection will not work. This is a known limitation. In development, you may need to relax CSP or use `--no-reload`.

## Route add/remove not appearing

If a newly added route does not appear:

1. Wait a moment for the debounce window (default 50ms).
2. Refresh the browser manually.
3. Run with `--debug-watch` to see if the route structure change was detected.
4. Ensure the route capsule has a `page.html` or `api.ts` file.

## Config change not reloading

If changing `boronix.config.ts` does not trigger a reload:

1. Verify the file is named `boronix.config.ts` (not `kumquat.config.ts` unless using legacy).
2. Run with `--debug-watch`.
3. If the config has a syntax error, the supervisor stays alive and reports `reload failed`. Fix and save it; it starts a fresh child automatically.

## Dev error page not showing

If you see a plain error instead of the Boronix dev error overlay:

1. Ensure you are in dev mode (`boronix dev`).
2. Check that `BORONIX_ENV` is not set to `production`.
3. The dev error page is served for HTML requests. API requests return JSON errors.
