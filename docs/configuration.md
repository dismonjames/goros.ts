# Boronix Configuration Guide

Configure Boronix using `boronix.config.ts` in your project root.

```ts
import { defineConfig } from "boronix"

export default defineConfig({
  runtime: "bun", // "bun" | "node"
  server: {
    port: 3000,
    host: "0.0.0.0"
  },
  session: {
    name: "my_app_session",
    secret: process.env.BORONIX_SESSION_SECRET,
    maxAge: 60 * 60 * 24, // 1 day
    secure: true
  },
  app: {
    root: "app",
    routesDir: "app/routes",
    publicDir: "public"
  },
  health: {
    enabled: true,
    path: "/health"
  },
  security: {
    headers: {
      contentTypeOptions: "nosniff",
      referrerPolicy: "strict-origin-when-cross-origin",
      frameOptions: "SAMEORIGIN"
    }
  },
  dev: {
    reload: true,
    watch: {
      debounce: 50
    }
  }
})
```

## Dev Configuration

- `dev.reload` — Enable/disable browser auto-refresh during development (default: `true`).
- `dev.watch.debounce` — File event debounce in milliseconds (default: `50`, range: `10–2000`).

CLI flags `--no-reload` and `--debug-watch` take priority over config.

## Production Config Validation

During `boronix build` or `boronix start`, Boronix validates:
- `server.port` must be an integer between 1 and 65535.
- `server.host` must be a non-empty string.
- `runtime` in config must match the active start runtime.
- `app.root`, `app.publicDir`, and `app.routesDir` must not traverse outside the project root.
- `session.secret` must be set if session or auth is used.
