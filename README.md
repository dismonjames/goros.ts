# Boronix

[![npm version](https://img.shields.io/npm/v/boronix.svg)](https://www.npmjs.com/package/boronix)
[![npm downloads](https://img.shields.io/npm/dm/boronix.svg)](https://www.npmjs.com/package/boronix)
[![license](https://img.shields.io/npm/l/boronix.svg)](./LICENSE)
[![CI](https://github.com/dismonjames/boronix.ts/actions/workflows/publish.yml/badge.svg)](https://github.com/dismonjames/boronix.ts/actions/workflows/publish.yml)

Boronix is an HTML-first fullstack framework for TypeScript.

Server-first, SSR-first, real HTML templates. No React. No client bundle by default. Bun is the primary runtime, Node is supported.

## Install

```bash
npm i boronix
```

Or scaffold a new app:

```bash
npm create boronix@latest my-app
# or:
npx create-boronix my-app
cd my-app
npm install
npm run dev
```

With Bun:

```bash
bunx create-boronix my-app
cd my-app
bun install
bun run dev
```

With SQLite database scaffolding:

```bash
npx create-boronix my-app --runtime bun --db sqlite
cd my-app
npm install
npm run db:push
npm run dev
```

## Generated App Scripts

```json
{
  "scripts": {
    "dev": "boronix dev",
    "build": "boronix build",
    "start": "boronix start",
    "doctor": "boronix doctor",
    "doctor:production": "boronix doctor --production",
    "typegen": "boronix typegen"
  }
}
```

## Quick Production Flow

To build and run your application in production:

```bash
npm create boronix@latest my-app
cd my-app
npm install

npm run build
npm run doctor:production
npm run start
```

If you are using the Homework/session template which requires sessions, provide the session secret:

```bash
BORONIX_SESSION_SECRET="replace-with-a-long-random-secret" npm run start
```
> [!NOTE]
> Writing secrets directly in the shell history is discouraged for real production environments. Use an environment manager or your hosting provider's deployment secrets config.


## CLI

```bash
boronix dev       # Start development server with live request log
boronix build     # Build production manifest
boronix start     # Start production server
boronix routes    # Print route tree
boronix inspect   # Inspect a specific route
boronix info      # Print environment info
boronix doctor    # Check project health
boronix typegen   # Generate route types
boronix db push   # Push Drizzle schema for DB apps
```

## Database

Boronix does not implement an ORM or migration engine. It provides Drizzle integration: SQLite/Postgres templates, the `app/db` convention, CLI wrappers, and a notes CRUD example.

```bash
npx create-boronix my-app --db sqlite
cd my-app
npm install
npm run db:push
npm run db:seed
npm run dev
```

Use SQLite for local/dev and small apps. Use Postgres for real deploys. See [Database docs](./docs/database.md).

SQLite requires `--runtime bun` because the template uses `bun:sqlite`; Postgres works with Bun or Node.

### Dev output

```txt
◆ Boronix

  ✔ mode      dev
  ✔ runtime   bun
  ➜ local     http://localhost:3000
  ⌂ root      ~/my-app
  ◇ reload    enabled

✔ ready, serving HTML in 58ms
```

## Fast development reload

Run:

```bash
npm run dev
```

Boronix watches pages, layouts, route modules, shared server code and public assets. Template/public changes refresh through SSE without restarting the server child; server TypeScript changes use an isolated child restart so stale ESM module caches cannot survive.

Boronix uses full-page refresh rather than a hydration-based client runtime.

### Build tree

```txt
◆ Boronix

  mode      build
  runtime   bun
  output    .boronix

  app/routes
  │
  ├─ root
  │  ├─ OK page  /        page   4ms
  │  └─ OK page  /login   page   6ms
  │
  └─ exercises
     ├─ OK page  /exercises       page   3ms
     └─ OK fn    /api/exercises   api    2ms

built server-rendered app in 41ms
```

## App Structure

```txt
app/
  routes/
    home/
      page.html       ← SSR HTML template
      page.ts         ← loader (returns data)
    exercises/
      page.html
      page.ts
      api.ts          ← JSON API handler
      actions.ts      ← form actions
  layout.html         ← root layout
public/               ← static assets
boronix.config.ts
```

## Config

```ts
import { defineConfig } from "boronix"

export default defineConfig({
  runtime: "bun",   // or "node"
  port: 3000,
})
```

## Page

```ts
// app/routes/home/page.ts
import { page } from "boronix"

export default page(async () => {
  return { title: "Home" }
})
```

```html
<!-- app/routes/home/page.html -->
<h1>{{ title }}</h1>
```

## API

```ts
// app/routes/exercises/api.ts
import { api, json } from "boronix"

export const GET = api(async () => {
  return json({ items: [] })
})
```

## Action

```ts
// app/routes/login/actions.ts
import { action, fail, redirect } from "boronix"

export const login = action(async ({ form }) => {
  const email = form.string("email")
  if (!email) return fail({ message: "Missing email" })
  return redirect("/dashboard")
})
```

```html
<form method="post" action="?/login">
  <input name="email" type="email" />
  <button>Login</button>
</form>
```

## Node Runtime

```bash
boronix dev --runtime node
boronix build --runtime node
boronix start --runtime node
```

## Run Examples

```bash
bun run dev:basic
bun run dev:homework
```

## Releases

See [CHANGELOG.md](./CHANGELOG.md) and [GitHub Releases](https://github.com/dismonjames/boronix.ts/releases).

## License

[MPL-2.0](./LICENSE)
