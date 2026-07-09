# Session

Sessions are signed cookie sessions.

```ts
export default defineConfig({
  session: {
    name: "kq_session",
    secret: process.env.SESSION_SECRET,
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
    secure: false
  }
})
```

Every page, API, and action context receives `session`.

```ts
session.get("key")
session.set("key", value)
session.delete("key")
session.clear()
```

Production requires a session secret. Development uses an insecure fallback with a warning.
