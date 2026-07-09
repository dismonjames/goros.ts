# Kumquat.ts

Kumquat.ts is an experimental v0.1 HTML-first fullstack framework for TypeScript.

It is server-first, SSR-first, and uses real HTML templates. Client JavaScript is not automatic, React is not part of the framework, and Bun is the first runtime target.

Kumquat is dogfooded through a small homework app using login, dashboard-style HTML pages, local actions, and JSON APIs.

## Install

```bash
bun install
```

## Create App

```bash
bunx create-kumquat my-app
cd my-app
bun install
bun run dev
```

## Run The Example

```bash
bun run dev:basic
```

## App Structure

```txt
app/
  routes/
    home/
      page.html
      page.ts
    exercises/
      page.html
      page.ts
      api.ts
  server/
  shared/
  layout.html
public/
kumquat.config.ts
```

## Page

```ts
import { page } from "kumquat"

export default page(async () => {
  return { title: "Dashboard" }
})
```

```html
<h1>{{ title }}</h1>
```

## API

```ts
import { api, json } from "kumquat"

export const GET = api(async () => {
  return json({ ok: true })
})
```

## Action

```ts
import { action, fail, redirect } from "kumquat"

export const login = action(async ({ form }) => {
  const email = form.string("email")

  if (!email) {
    return fail({ message: "Missing email" })
  }

  return redirect("/exercises")
})
```

```html
<form method="post" action="?/login">
  <input name="email" type="email">
  <button>Login</button>
</form>
```

## License

MPL-2.0.
