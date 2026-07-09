import { action, fail, redirect } from "kumquat"

export const login = action(async ({ form, auth, flash }) => {
  const email = form.required("email", "Email is required")
  const password = form.required("password", "Password is required")

  form.email("email", "Invalid email")
  form.min("password", 6, "Password too short")

  if (!form.isValid()) {
    return fail({
      message: "Please check the form",
      fields: form.errors(),
      values: form.values()
    })
  }

  if (email !== "demo@example.com" || password !== "demo123") {
    return fail({
      message: "Invalid credentials",
      fields: {},
      values: form.values()
    })
  }

  auth.login({
    email,
    name: "Demo User"
  })
  flash.set("success", "Logged in")

  return redirect("/dashboard")
})
