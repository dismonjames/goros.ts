import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { expect, test } from "bun:test"
import { createKumquatApp } from "../packages/kumquat/src/core/app"
import { defaultConfig } from "../packages/kumquat/src/config/types"
import { scanRoutes } from "../packages/kumquat/src/scanner/scan-routes"

test("v0.2 auth validation fail and flash flow", async () => {
  const root = path.join(os.tmpdir(), `kumquat-v02-${Date.now()}`)
  const appRoot = path.join(root, "app")
  const routes = path.join(appRoot, "routes")
  const kumquatImport = pathToFileURL(path.resolve("packages/kumquat/src/index.ts")).href

  mkdirSync(path.join(routes, "login"), { recursive: true })
  mkdirSync(path.join(routes, "dashboard"), { recursive: true })
  mkdirSync(path.join(root, "public"), { recursive: true })

  writeFileSync(path.join(appRoot, "layout.html"), "<html>{{#each flash}}<p>{{ message }}</p>{{/each}}{{ slot }}</html>")
  writeFileSync(path.join(routes, "dashboard", "layout.html"), "<section>{{ slot }}</section>")
  writeFileSync(path.join(routes, "login", "page.html"), "<form>{{#if message}}<b>{{ message }}</b>{{/if}}<input name=\"email\" value=\"{{ values.email }}\">{{#if fields.email}}<i>{{ fields.email }}</i>{{/if}}</form>")
  writeFileSync(path.join(routes, "login", "page.ts"), `import { page } from '${kumquatImport}'; export default page(async () => ({ title: 'Login', fields: {}, values: {} }))`)
  writeFileSync(path.join(routes, "login", "actions.ts"), `import { action, fail, redirect } from '${kumquatImport}';
export const login = action(async ({ form, auth, flash }) => {
  const email = form.required('email', 'Email is required')
  const password = form.required('password', 'Password is required')
  form.email('email', 'Invalid email')
  form.min('password', 6, 'Password too short')
  if (!form.isValid()) return fail({ message: 'Please check the form', fields: form.errors(), values: form.values() })
  auth.login({ email, name: 'Demo User' })
  flash.set('success', 'Logged in')
  return redirect('/dashboard')
})`)
  writeFileSync(path.join(routes, "dashboard", "page.html"), "<h1>{{ user.name }}</h1>")
  writeFileSync(path.join(routes, "dashboard", "page.ts"), `import { page, redirect } from '${kumquatImport}'; export default page(async ({ auth }) => {
  const user = auth.user()
  if (!user) return redirect('/login')
  return { title: 'Dashboard', user }
})`)
  writeFileSync(path.join(routes, "dashboard", "actions.ts"), `import { action, redirect } from '${kumquatImport}'; export const logout = action(async ({ auth, flash }) => {
  auth.logout()
  flash.set('success', 'Logged out')
  return redirect('/login')
})`)

  const manifest = scanRoutes(routes)
  const app = createKumquatApp({
    root,
    config: {
      ...defaultConfig,
      session: {
        ...defaultConfig.session,
        secret: "v02-test-secret"
      }
    },
    manifest
  })

  const failResponse = await app.fetch(postForm("http://local/login?/login", {
    email: "bad",
    password: "123"
  }))
  const failHtml = await failResponse.text()
  expect(failResponse.status).toBe(400)
  expect(failHtml).toContain("Please check the form")
  expect(failHtml).toContain("bad")
  expect(failHtml).toContain("Invalid email")

  const loginResponse = await app.fetch(postForm("http://local/login?/login", {
    email: "demo@example.com",
    password: "demo123"
  }))
  const loginCookie = loginResponse.headers.get("set-cookie") ?? ""
  expect(loginResponse.status).toBe(303)
  expect(loginResponse.headers.get("location")).toBe("/dashboard")
  expect(loginCookie).toContain("kq_session=")

  const dashboardResponse = await app.fetch(new Request("http://local/dashboard", {
    headers: {
      cookie: loginCookie
    }
  }))
  expect(await dashboardResponse.text()).toContain("<section><h1>Demo User</h1></section>")

  const logoutResponse = await app.fetch(new Request("http://local/dashboard?/logout", {
    method: "POST",
    headers: {
      cookie: loginCookie
    }
  }))
  const logoutCookie = logoutResponse.headers.get("set-cookie") ?? ""
  expect(logoutResponse.headers.get("location")).toBe("/login")

  const flashResponse = await app.fetch(new Request("http://local/login", {
    headers: {
      cookie: logoutCookie
    }
  }))
  const flashCookie = flashResponse.headers.get("set-cookie") ?? ""
  expect(await flashResponse.text()).toContain("Logged out")

  const consumedResponse = await app.fetch(new Request("http://local/login", {
    headers: {
      cookie: flashCookie
    }
  }))
  expect(await consumedResponse.text()).not.toContain("Logged out")

  rmSync(root, { recursive: true, force: true })
})

function postForm(url: string, values: Record<string, string>): Request {
  const form = new URLSearchParams()
  for (const [name, value] of Object.entries(values)) {
    form.set(name, value)
  }
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: form.toString()
  })
}
