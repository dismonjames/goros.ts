# Auth

Auth helpers are minimal and session-backed.

```ts
export default page(async ({ auth }) => {
  const user = auth.user()
  if (!user) return redirect("/login")
  return { user }
})
```

```ts
auth.login({ email: "demo@example.com" })
auth.logout()
auth.user()
auth.requireUser()
```

Kumquat does not include providers, password hashing, or databases in v0.2.
