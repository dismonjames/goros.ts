# Forms

Actions receive a decorated `form`.

```ts
const email = form.required("email", "Email is required")
form.email("email", "Invalid email")
form.min("password", 6, "Password too short")

if (!form.isValid()) {
  return fail({
    message: "Please check the form",
    fields: form.errors(),
    values: form.values()
  })
}
```

Helpers:

- `string(name)`
- `required(name, message)`
- `email(name, message)`
- `min(name, length, message)`
- `number(name, message)`
- `boolean(name)`
- `values()`
- `errors()`
- `isValid()`
